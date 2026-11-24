import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AddAsm, AddHack } from "@nand2tetris/projects/samples/project_06/01_add.js";
import { builtinOverrides } from "@nand2tetris/simulator/chip/builtins/builtinOverrides.js";
import { lessons } from "./lessons.mjs";

const tool = join(import.meta.dirname, "tool.mjs");
const andHdl = "CHIP And { IN a,b; OUT out; PARTS: Nand(a=a,b=b,out=n); Nand(a=n,b=n,out=out); }";
const wrongAnd = "CHIP And { IN a,b; OUT out; PARTS: Nand(a=a,b=b,out=out); }";
const xorHdl = "CHIP Xor { IN a,b; OUT out; PARTS: Or(a=a,b=b,out=any); Nand(a=a,b=b,out=notBoth); And(a=any,b=notBoth,out=out); }";

function runAt(cwd, ...args) {
  return spawnSync(process.execPath, [tool, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 20000,
  });
}

function run(...args) {
  return runAt(process.cwd(), ...args);
}

test("official HDL comparison returns a failing exit code on incorrect output", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nand-seminar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const local = join(dir, "And.hdl");
  const fixture = (name) => `seminar/hardware/lesson-1/And.${name}`;
  await writeFile(local, wrongAnd);
  const wrong = run("hdl", local, fixture("tst"), fixture("cmp"));
  assert.equal(wrong.status, 1, wrong.stderr);
  assert.match(wrong.stderr, /Mismatch/);

  await writeFile(local, andHdl);
  const correct = run("hdl", local, fixture("tst"), fixture("cmp"), "--isolated");
  assert.equal(correct.status, 0, correct.stderr);
});

test("lesson checks continue after failures and missing files and report the exit status", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nand-seminar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const lesson1 = "seminar/hardware/lesson-1";
  const hardware = join(dir, lesson1);
  const extraChips = lessons[1].checks.map(([, chip]) => chip).filter((chip) => !["And", "Xor", "Mux"].includes(chip));
  await mkdir(hardware, { recursive: true });
  for (const name of ["And.tst", "And.cmp", "Xor.tst", "Mux.tst", "Mux.cmp"]) {
    await copyFile(join(lesson1, name), join(hardware, name));
  }
  await writeFile(join(hardware, "And.hdl"), wrongAnd);
  await writeFile(join(hardware, "Xor.hdl"), xorHdl);
  await writeFile(join(hardware, "Mux.hdl"), "CHIP Mux { IN a,b,sel; OUT out; BUILTIN Mux; }");

  const partial = runAt(dir, "lesson", "1");
  assert.equal(partial.status, 1, partial.stderr);
  assert.match(partial.stdout, /FAIL  And\n  Mismatch[^\n]*\n[\s\S]*?SKIP  Xor\n  Missing file: .*Xor\.cmp\nPASS  Mux/);
  assert.ok(partial.stdout.includes(`Passed: 1\nFailed: 1\nSkipped: ${1 + extraChips.length}\n\nResult: FAIL`));

  await writeFile(join(hardware, "And.hdl"), andHdl);
  const missingOnly = runAt(dir, "lesson", "1");
  assert.equal(missingOnly.status, 1, missingOnly.stderr);
  assert.ok(missingOnly.stdout.includes(`Passed: 2\nFailed: 0\nSkipped: ${1 + extraChips.length}\n\nResult: FAIL`));

  await copyFile(join(lesson1, "Xor.cmp"), join(hardware, "Xor.cmp"));
  await writeFile(join(hardware, "And.hdl"), "CHIP And { IN a,b; OUT out; PARTS: }");
  const isolated = runAt(dir, "lesson", "1");
  assert.equal(isolated.status, 1, isolated.stderr);
  assert.match(isolated.stdout, /^PASS  Xor$/m);
  const integrated = runAt(dir, "lesson", "1", "--integrated");
  assert.equal(integrated.status, 1, integrated.stderr);
  assert.match(integrated.stdout, /FAIL  Xor\n(?:  DEP .*\n)*  DEP And: LOCAL .*And\.hdl/);
  assert.match(integrated.stdout, /DEP Or: BUILTIN \(fallback\)/);
  assert.match(integrated.stdout, /DEP Mux: BUILTIN \(.*Mux\.hdl\)/);

  await writeFile(join(hardware, "And.hdl"), andHdl);
  for (const chip of extraChips) {
    const source = await readFile(join(lesson1, `${chip}.hdl`), "utf8");
    await writeFile(join(hardware, `${chip}.hdl`), source.replace(/PARTS:[\s\S]*$/, `BUILTIN ${chip};\n}\n`));
    for (const extension of ["tst", "cmp"]) {
      const name = `${chip}.${extension}`;
      await copyFile(join(lesson1, name), join(hardware, name));
    }
  }
  const complete = runAt(dir, "lesson", "1", "--integrated");
  assert.equal(complete.status, 0, complete.stdout + complete.stderr);
  assert.ok(complete.stdout.includes(`Passed: ${lessons[1].checks.length}\nFailed: 0\nSkipped: 0\n\nResult: PASS`));
});

test("assembled code runs on HDL Computer with the local HDL CPU", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nand-seminar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cpuDir = join(dir, "seminar", "hardware", "lesson-5");
  const computerDir = join(dir, "seminar", "hardware", "lesson-6");
  await mkdir(cpuDir, { recursive: true });
  await mkdir(computerDir, { recursive: true });
  const cpuFile = join(cpuDir, "CPU.hdl");
  const file = (name) => join(computerDir, name);
  await writeFile(file("Computer.hdl"), `CHIP Computer {
    IN reset;
    PARTS:
    ROM32K(address=pc,out=instruction);
    CPU(inM=inM,instruction=instruction,reset=reset,outM=outM,writeM=writeM,addressM=addressM,pc=pc);
    Memory(in=outM,load=writeM,address=addressM,out=inM);
  }`);
  await writeFile(cpuFile, builtinOverrides.CPU);
  await writeFile(file("Add.asm"), AddAsm);

  const fixture = (ext) => join(import.meta.dirname, "hardware", "lesson-6", `ComputerAdd.${ext}`);
  const args = ["hdl", file("Computer.hdl"), fixture("tst"), fixture("cmp")];
  const computer = ["computer", file("Add.asm"), file("Computer.hdl"), args[2], args[3]];
  const chained = runAt(dir, ...computer, "--integrated");
  assert.equal(chained.status, 0, chained.stderr);
  assert.match(chained.stdout, /DEP CPU: LOCAL .*lesson-5\/CPU\.hdl/);
  assert.match(chained.stdout, /DEP PC: BUILTIN \(fallback\)/);

  const assembly = run("assemble", file("Add.asm"), file("Add.hack"));
  assert.equal(assembly.status, 0, assembly.stderr);
  const words = (await readFile(file("Add.hack"), "utf8")).trim().split("\n");
  assert.deepEqual(words, AddHack.map((word) => word.toString(2).padStart(16, "0")));
  const correct = runAt(dir, ...args);
  assert.equal(correct.status, 0, correct.stderr);

  await writeFile(cpuFile, builtinOverrides.CPU.replace("out=writeM", "out=disabledWrite").replace("\n    Or(a=negative", "\n    And(a=false,b=false,out=writeM);\n    Or(a=negative"));
  const wrong = runAt(dir, ...args);
  assert.equal(wrong.status, 1, wrong.stderr);
  assert.match(wrong.stderr, /Mismatch/);
  const isolated = runAt(dir, ...computer, "--isolated");
  assert.equal(isolated.status, 0, isolated.stderr);
});

test("the official Memory test receives keyboard input and detects an unwired Keyboard", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nand-seminar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "Memory.hdl");
  const fixture = "seminar/hardware/lesson-6/Memory";
  const args = ["hdl", source, `${fixture}.tst`, `${fixture}.cmp`, "--isolated"];
  const header = "CHIP Memory { IN in[16], load, address[15]; OUT out[16];";
  await writeFile(source, `${header} BUILTIN Memory; }`);
  const correct = run(...args);
  assert.equal(correct.status, 0, correct.stderr);

  await writeFile(source, `${header} PARTS: Keyboard(out=unused); And16(a=false,b=false,out=out); }`);
  const wrong = run(...args);
  assert.equal(wrong.status, 1, wrong.stderr);
  assert.match(wrong.stderr, /Memory did not report keyboard input K/);
});

test("the assembly rehearsal uses the CPU emulator and checks RAM", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nand-seminar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const programFixtures = join(import.meta.dirname, "programs", "lesson-4");
  const programs = join(dir, "seminar", "programs", "lesson-4");
  await mkdir(programs, { recursive: true });
  const asm = join(programs, "Add.asm");
  await writeFile(asm, AddAsm);
  for (const name of ["Add.tst", "Add.cmp"]) {
    await copyFile(join(programFixtures, name), join(programs, name));
  }
  const result = runAt(dir, "cpu", "Add");
  assert.equal(result.status, 0, result.stderr);
  const lesson = runAt(dir, "lesson", "4", "--integrated");
  assert.equal(lesson.status, 1, lesson.stdout + lesson.stderr);
  assert.match(lesson.stdout, /^PASS  Add$/m);
  assert.match(lesson.stdout, /SKIP  Mult/);
  assert.match(lesson.stdout, /SKIP  Fill/);
});
