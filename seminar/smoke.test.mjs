import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AddAsm, AddHack } from "@nand2tetris/projects/samples/project_06/01_add.js";
import { builtinOverrides } from "@nand2tetris/simulator/chip/builtins/builtinOverrides.js";

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
  const fixture = (name) => `seminar/hardware/And.${name}`;
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
  const hardware = join(dir, "seminar", "hardware");
  await mkdir(hardware, { recursive: true });
  for (const name of ["And.tst", "And.cmp", "Xor.tst", "Mux.tst", "Mux.cmp"]) {
    await copyFile(`seminar/hardware/${name}`, join(hardware, name));
  }
  await writeFile(join(hardware, "And.hdl"), wrongAnd);
  await writeFile(join(hardware, "Xor.hdl"), xorHdl);
  await writeFile(join(hardware, "Mux.hdl"), "CHIP Mux { IN a,b,sel; OUT out; BUILTIN Mux; }");

  const partial = runAt(dir, "lesson", "1");
  assert.equal(partial.status, 1, partial.stderr);
  assert.match(partial.stdout, /FAIL  And\n  Mismatch.*\nSKIP  Xor\n  Missing file: .*Xor\.cmp\nPASS  Mux/);
  assert.match(partial.stdout, /Passed: 1\nFailed: 1\nSkipped: 1\n\nResult: FAIL/);

  await writeFile(join(hardware, "And.hdl"), andHdl);
  const missingOnly = runAt(dir, "lesson", "1");
  assert.equal(missingOnly.status, 1, missingOnly.stderr);
  assert.match(missingOnly.stdout, /Passed: 2\nFailed: 0\nSkipped: 1\n\nResult: FAIL/);

  await copyFile("seminar/hardware/Xor.cmp", join(hardware, "Xor.cmp"));
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
  const complete = runAt(dir, "lesson", "1", "--integrated");
  assert.equal(complete.status, 0, complete.stdout + complete.stderr);
  assert.match(complete.stdout, /Passed: 3\nFailed: 0\nSkipped: 0\n\nResult: PASS/);
});

test("assembled code runs on HDL Computer with the local HDL CPU", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nand-seminar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = (name) => join(dir, name);
  await writeFile(file("Computer.hdl"), `CHIP Computer {
    IN reset;
    PARTS:
    ROM32K(address=pc,out=instruction);
    CPU(inM=inM,instruction=instruction,reset=reset,outM=outM,writeM=writeM,addressM=addressM,pc=pc);
    Memory(in=outM,load=writeM,address=addressM,out=inM);
  }`);
  await writeFile(file("CPU.hdl"), builtinOverrides.CPU);
  await writeFile(file("Add.asm"), AddAsm);

  const args = ["hdl", file("Computer.hdl"), "seminar/hardware/ComputerAdd.tst", "seminar/hardware/ComputerAdd.cmp"];
  const computer = ["computer", file("Add.asm"), file("Computer.hdl"), args[2], args[3]];
  const chained = run(...computer, "--integrated");
  assert.equal(chained.status, 0, chained.stderr);
  assert.match(chained.stdout, /DEP CPU: LOCAL .*CPU\.hdl/);
  assert.match(chained.stdout, /DEP PC: BUILTIN \(fallback\)/);

  const assembly = run("assemble", file("Add.asm"), file("Add.hack"));
  assert.equal(assembly.status, 0, assembly.stderr);
  const words = (await readFile(file("Add.hack"), "utf8")).trim().split("\n");
  assert.deepEqual(words, AddHack.map((word) => word.toString(2).padStart(16, "0")));
  const correct = run(...args);
  assert.equal(correct.status, 0, correct.stderr);

  await writeFile(file("CPU.hdl"), builtinOverrides.CPU.replace("out=writeM", "out=disabledWrite").replace("\n    Or(a=negative", "\n    And(a=false,b=false,out=writeM);\n    Or(a=negative"));
  const wrong = run(...args);
  assert.equal(wrong.status, 1, wrong.stderr);
  assert.match(wrong.stderr, /Mismatch/);
  const isolated = run(...computer, "--isolated");
  assert.equal(isolated.status, 0, isolated.stderr);
});

test("the assembly rehearsal uses the CPU emulator and checks RAM", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nand-seminar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const programs = join(dir, "seminar", "programs");
  await mkdir(programs, { recursive: true });
  const asm = join(programs, "Add.asm");
  await writeFile(asm, AddAsm);
  for (const name of ["Add.tst", "Add.cmp"]) {
    await copyFile(`seminar/programs/${name}`, join(programs, name));
  }
  const result = run("cpu", asm, "seminar/programs/Add.tst", "seminar/programs/Add.cmp");
  assert.equal(result.status, 0, result.stderr);
  const lesson = runAt(dir, "lesson", "4", "--integrated");
  assert.equal(lesson.status, 0, lesson.stdout + lesson.stderr);
  assert.match(lesson.stdout, /^PASS  Add$/m);
});
