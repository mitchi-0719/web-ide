import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { NodeFileSystem } from "@davidsouther/jiffies/fs_node.ts";
import { unwrap } from "@davidsouther/jiffies/result.ts";
import { build } from "@nand2tetris/simulator/chip/builder.js";
import { ROM } from "@nand2tetris/simulator/cpu/memory.js";
import { compare } from "@nand2tetris/simulator/compare.js";
import { CMP } from "@nand2tetris/simulator/languages/cmp.js";
import { HDL } from "@nand2tetris/simulator/languages/hdl.js";
import { TST } from "@nand2tetris/simulator/languages/tst.js";
import { loadAsm } from "@nand2tetris/simulator/loader.js";
import { ChipTest } from "@nand2tetris/simulator/test/chiptst.js";
import { CPUTest } from "@nand2tetris/simulator/test/cputst.js";

const read = (file) => readFile(file, "utf8");

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
  return basename(input) === input && !input.endsWith(extension) ? join("seminar", folder, file) : file;
}

function hackText(words) {
  return words.map((word) => (word & 0xffff).toString(2).padStart(16, "0")).join("\n") + "\n";
}

async function testHdl(hdlFile, testFile, cmpFile, rom) {
  const dir = dirname(resolve(hdlFile));
  const fs = new NodeFileSystem(dir);
  const chip = unwrap(await build({
    parts: unwrap(HDL.parse(await read(hdlFile))),
    name: basename(hdlFile, ".hdl"),
    dir,
    fs,
    localAncestors: new Set(),
  }));
  try {
    const test = unwrap(ChipTest.from(unwrap(TST.parse(await read(testFile))), { dir }));
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

async function main([command, ...args]) {
  if (command === "computer" && [0, 1, 4].includes(args.length)) {
    const [source = "Add", target = "Computer"] = args;
    const asm = sourcePath(source, "programs", ".asm");
    const hdl = sourcePath(target, "hardware", ".hdl");
    const stem = basename(asm, ".asm");
    const [test = join(dirname(hdl), `Computer${stem}.tst`), cmp = test.replace(/\.tst$/, ".cmp")] = args.slice(2);
    await testHdl(hdl, test, cmp, {
      filename: `${stem}.hack`,
      contents: hackText(await loadAsm(await read(asm))),
    });
    console.log(`PASS ${test}`);
    return;
  }
  if (command === "assemble" && [1, 2].includes(args.length)) {
    const source = sourcePath(args[0], "programs", ".asm");
    const output = args[1] ?? source.replace(/\.asm$/, ".hack");
    if (!source.endsWith(".asm") || !output.endsWith(".hack")) {
      throw new Error("Expected an .asm input and a .hack output");
    }
    const words = await loadAsm(await read(source));
    await writeFile(output, hackText(words));
    console.log(`Assembled ${words.length} instructions into ${output}`);
    return;
  }
  if (command === "cpu" && [1, 3].includes(args.length)) {
    const asm = sourcePath(args[0], "programs", ".asm");
    const [testFile = asm.replace(/\.asm$/, ".tst"), cmpFile = testFile.replace(/\.tst$/, ".cmp")] = args.slice(1);
    if (!asm.endsWith(".asm") || !testFile.endsWith(".tst") || !cmpFile.endsWith(".cmp")) {
      throw new Error("Expected .asm, .tst and .cmp files");
    }
    const words = await loadAsm(await read(asm));
    const test = unwrap(CPUTest.from(unwrap(TST.parse(await read(testFile))), {
      rom: new ROM(Int16Array.from(words)),
      requireLoad: false,
    }));
    await test.run();
    await compareOutput(cmpFile, test.log());
    console.log(`PASS ${testFile}`);
    return;
  }
  if (command === "hdl" && (args.length === 1 || args.length === 3)) {
    const hdl = sourcePath(args[0], "hardware", ".hdl");
    const [test = hdl.replace(/\.hdl$/, ".tst"), cmp = test.replace(/\.tst$/, ".cmp")] = args.slice(1);
    if (!hdl.endsWith(".hdl") || !test.endsWith(".tst") || !cmp.endsWith(".cmp")) {
      throw new Error("Expected .hdl, .tst and .cmp files");
    }
    await testHdl(hdl, test, cmp);
    console.log(`PASS ${test}`);
    return;
  }
  throw new Error("使い方は ./check --help を参照してください。");
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
