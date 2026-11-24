import { spawnSync } from "node:child_process";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { NodeFileSystem } from "@davidsouther/jiffies/fs_node.ts";
import { unwrap } from "@davidsouther/jiffies/result.ts";
import { build } from "@nand2tetris/simulator/chip/builder.js";
import { hasBuiltinChip } from "@nand2tetris/simulator/chip/builtins/index.js";
import { ROM } from "@nand2tetris/simulator/cpu/memory.js";
import { compare } from "@nand2tetris/simulator/compare.js";
import { CMP } from "@nand2tetris/simulator/languages/cmp.js";
import { HDL } from "@nand2tetris/simulator/languages/hdl.js";
import { TST } from "@nand2tetris/simulator/languages/tst.js";
import { loadAsm } from "@nand2tetris/simulator/loader.js";
import { ChipTest } from "@nand2tetris/simulator/test/chiptst.js";
import { CPUTest } from "@nand2tetris/simulator/test/cputst.js";
import { lessons } from "./lessons.mjs";

const read = (file) => readFile(file, "utf8");
const hardware = join("seminar", "hardware");
const programs = join("seminar", "programs", "lesson-4");

function hardwareLesson(chip) {
  return Object.keys(lessons).find((number) => lessons[number].checks.some(
    ([command, name]) => (command === "hdl" && name === chip) || (command === "computer" && chip === "Computer"),
  ));
}

async function compareOutput(expectedFile, output) {
  const differences = compare(
    unwrap(CMP.parse(await read(expectedFile))),
    unwrap(CMP.parse(output)),
  );
  if (differences.length) {
    const { row, col, a, b } = differences[0];
    throw new Error(`Mismatch at row ${row + 1}, column ${col + 1}: expected ${a}, got ${b}`);
  }
}

function sourcePath(input, folder, extension) {
  if (!input) throw new Error(`Expected a ${extension} source file`);
  const file = input.endsWith(extension) ? input : input + extension;
  if (basename(input) !== input || input.endsWith(extension)) return file;
  const lesson = folder === hardware ? hardwareLesson(input) : undefined;
  return lesson ? join(folder, `lesson-${lesson}`, file) : join(folder, file);
}

function hackText(words) {
  return words.map((word) => (word & 0xffff).toString(2).padStart(16, "0")).join("\n") + "\n";
}

function findKeyboard(chip) {
  if (chip.name === "Keyboard" && typeof chip.setKey === "function") return chip;
  for (const part of chip.parts) {
    const keyboard = findKeyboard(part);
    if (keyboard) return keyboard;
  }
}

function driveMemoryKeyboard(test, chip) {
  const tick = test.tick.bind(test);
  let key = "";
  let ticks = 0;
  test.echo = (message) => {
    const requestedKey = message.match(/hold down (?:the )?'([A-Z])'/i);
    if (!requestedKey) return;
    key = requestedKey[1];
    const keyboard = findKeyboard(chip);
    if (!keyboard) throw new Error(`Memory test needs a Keyboard chip for key ${key}`);
    keyboard.setKey(key.charCodeAt(0));
    ticks = 0;
  };
  test.clearEcho = () => { key = ""; };
  test.tick = () => {
    if (key && ++ticks > 16) throw new Error(`Memory did not report keyboard input ${key} after 16 cycles`);
    tick();
  };
}

async function testHdl(hdlFile, testFile, cmpFile, mode, rom) {
  const name = basename(hdlFile, ".hdl");
  const parts = unwrap(HDL.parse(await read(hdlFile)));
  const dir = await realpath(dirname(resolve(hdlFile)));
  const fs = new NodeFileSystem(dir);
  const dependencies = new Map();
  const lesson = dirname(dir) === resolve(hardware) ? /^lesson-(\d+)$/.exec(basename(dir))?.[1] : undefined;
  const earlierDirs = Object.keys(lessons).filter((number) => Number(number) < Number(lesson)).reverse()
    .map((number) => resolve(hardware, `lesson-${number}`));
  const dependencyDirs = [dir, ...earlierDirs];
  let dependencyFs = fs;
  if (mode === "isolated") dependencyFs = undefined;
  else if (mode === "integrated" || earlierDirs.length) {
    dependencyFs = {
      async readFile(path) {
        const part = basename(path, ".hdl");
        for (const [index, directory] of dependencyDirs.entries()) {
          const candidate = join(directory, basename(path));
          try {
            const source = await fs.readFile(candidate);
            if (mode === "integrated" && !dependencies.has(part)) {
              const builtin = HDL.parse(source).ok?.parts === "BUILTIN";
              dependencies.set(part, builtin ? `BUILTIN (${candidate})` : `LOCAL (${candidate})`);
            }
            return source;
          } catch (error) {
            if (error.code === "ENOENT" && index < dependencyDirs.length - 1) continue;
            const status = error.code === "ENOENT"
              ? (hasBuiltinChip(part) ? "BUILTIN (fallback)" : "MISSING")
              : `ERROR (${candidate}: ${error.code ?? error.message})`;
            if (mode === "integrated") dependencies.set(part, status);
            throw error;
          }
        }
      },
    };
    if (mode === "integrated" && parts.parts === "BUILTIN") dependencies.set(name, `BUILTIN (${resolve(hdlFile)})`);
  }

  let chip;
  try {
    chip = unwrap(await build({ parts, name, dir, fs: dependencyFs, localAncestors: new Set() }));
  } finally {
    for (const [part, source] of dependencies) console.log(`DEP ${part}: ${source}`);
  }

  try {
    const test = unwrap(ChipTest.from(unwrap(TST.parse(await read(testFile))), { dir }));
    if (name === "Memory" && basename(testFile) === "Memory.tst") driveMemoryKeyboard(test, chip);
    if (rom) {
      const loadROM = test.loadROM.bind(test);
      test.loadROM = async (filename) => {
        if (filename !== rom.filename) return loadROM(filename);
        rom.loaded = true;
        await chip.load({ readFile: async () => rom.contents }, filename);
      };
    }
    test.with(chip).setFileSystem(fs);
    await test.run();
    if (rom && !rom.loaded) throw new Error(`Test must load ${rom.filename} in ROM32K`);
    await compareOutput(cmpFile, test.log());
  } finally {
    chip.remove();
  }
}

function verificationFiles(command, args) {
  if (command === "computer" && [0, 1, 4].includes(args.length)) {
    const [source = "Add", target = "Computer"] = args;
    const asm = sourcePath(source, programs, ".asm");
    const hdl = sourcePath(target, hardware, ".hdl");
    const stem = basename(asm, ".asm");
    const [test = join(dirname(hdl), `Computer${stem}.tst`), cmp = test.replace(/\.tst$/, ".cmp")] = args.slice(2);
    return [asm, hdl, test, cmp];
  }
  if (command === "cpu" && [1, 3].includes(args.length)) {
    const asm = sourcePath(args[0], programs, ".asm");
    const defaultTest = resolve(asm) === resolve(programs, "Fill.asm")
      ? join(programs, "FillAutomatic.tst") : asm.replace(/\.asm$/, ".tst");
    const [testFile = defaultTest, cmpFile = testFile.replace(/\.tst$/, ".cmp")] = args.slice(1);
    if (!asm.endsWith(".asm") || !testFile.endsWith(".tst") || !cmpFile.endsWith(".cmp")) {
      throw new Error("Expected .asm, .tst and .cmp files");
    }
    return [asm, testFile, cmpFile];
  }
  if (command === "hdl" && (args.length === 1 || args.length === 3)) {
    const hdl = sourcePath(args[0], hardware, ".hdl");
    const [test = hdl.replace(/\.hdl$/, ".tst"), cmp = test.replace(/\.tst$/, ".cmp")] = args.slice(1);
    if (!hdl.endsWith(".hdl") || !test.endsWith(".tst") || !cmp.endsWith(".cmp")) {
      throw new Error("Expected .hdl, .tst and .cmp files");
    }
    return [hdl, test, cmp];
  }
  throw new Error("使い方は ./check --help を参照してください。");
}

async function missingFiles(files) {
  const missing = [];
  for (const file of files) {
    try {
      if (!(await stat(file)).isFile()) missing.push(file);
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
      missing.push(file);
    }
  }
  return missing;
}

async function runLesson(number, mode) {
  if (!Object.hasOwn(lessons, number)) throw new Error("授業回は 1〜6 を指定してください。");
  const { title, checks } = lessons[number];
  console.log(`Lesson ${number}: ${title}`);
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 };
  for (const [command, ...args] of checks) {
    const label = command === "computer" ? `Computer (${args[0]})` : args[0];
    let status = "FAIL";
    let details;
    try {
      const missing = await missingFiles(verificationFiles(command, args));
      if (missing.length) {
        status = "SKIP";
        details = missing.map((file) => `Missing file: ${file}`);
      } else {
        const dependencyMode = mode ?? (command === "computer" ? "integrated" : "isolated");
        const flags = command === "cpu" ? [] : [`--${dependencyMode}`, "--"];
        // Each test gets its own simulator state, even after a failed chip build.
        const result = spawnSync(process.execPath, [import.meta.filename, command, ...flags, ...args], { encoding: "utf8" });
        if (result.error) throw result.error;
        status = result.status === 0 ? "PASS" : "FAIL";
        details = `${result.stdout}${result.stderr}`.trim().split("\n")
          .filter((line) => line && !line.startsWith("PASS "));
        if (result.signal) details.push(`Test process terminated by ${result.signal}`);
      }
    } catch (error) {
      details = [error.message];
    }
    counts[status]++;
    console.log(`${status}  ${label}`);
    for (const detail of details) console.log(`  ${detail}`);
  }
  const passed = checks.length > 0 && counts.PASS === checks.length;
  console.log(`\nPassed: ${counts.PASS}\nFailed: ${counts.FAIL}\nSkipped: ${counts.SKIP}\n\nResult: ${passed ? "PASS" : "FAIL"}`);
  return passed ? 0 : 1;
}

function dependencyOptions(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { isolated: { type: "boolean" }, integrated: { type: "boolean" } },
  });
  if (values.isolated && values.integrated) {
    throw new Error("--isolated と --integrated はどちらか一方を指定してください。");
  }
  const mode = values.isolated ? "isolated" : values.integrated ? "integrated" : undefined;
  return { mode, positionals };
}

async function main([command, ...args]) {
  let mode;
  if (["hdl", "computer", "lesson"].includes(command)) {
    ({ mode, positionals: args } = dependencyOptions(args));
  }
  if (command === "lesson" && args.length === 1) return runLesson(args[0], mode);
  if (command === "assemble" && [1, 2].includes(args.length)) {
    const source = sourcePath(args[0], programs, ".asm");
    const output = args[1] ?? source.replace(/\.asm$/, ".hack");
    if (!source.endsWith(".asm") || !output.endsWith(".hack")) {
      throw new Error("Expected an .asm input and a .hack output");
    }
    const words = await loadAsm(await read(source));
    await writeFile(output, hackText(words));
    console.log(`Assembled ${words.length} instructions into ${output}`);
    return;
  }

  const files = verificationFiles(command, args);
  if (command === "computer") {
    const [asm, hdl, test, cmp] = files;
    await testHdl(hdl, test, cmp, mode, {
      filename: `${basename(asm, ".asm")}.hack`,
      contents: hackText(await loadAsm(await read(asm))),
    });
    console.log(`PASS ${test}`);
  } else if (command === "cpu") {
    const [asm, testFile, cmpFile] = files;
    const words = await loadAsm(await read(asm));
    if (!words.length) throw new Error(`No instructions in ${asm}`);
    const test = unwrap(CPUTest.from(unwrap(TST.parse(await read(testFile))), {
      dir: resolve(asm),
      rom: new ROM(Int16Array.from(words)),
      requireLoad: false,
    }));
    await test.run();
    await compareOutput(cmpFile, test.log());
    console.log(`PASS ${testFile}`);
  } else {
    const [hdl, test, cmp] = files;
    await testHdl(hdl, test, cmp, mode);
    console.log(`PASS ${test}`);
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
