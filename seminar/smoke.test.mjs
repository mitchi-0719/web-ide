import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { builtinOverrides } from "@nand2tetris/simulator/chip/builtins/builtinOverrides.js";

function run(...args) {
  return spawnSync(process.execPath, ["seminar/tool.mjs", ...args], {
    encoding: "utf8",
    timeout: 20000,
  });
}

test("official HDL comparison returns a failing exit code on incorrect output", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "nand-seminar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const local = join(dir, "And.hdl");
  const fixture = (name) => `seminar/hardware/And.${name}`;
  await writeFile(local, "CHIP And { IN a,b; OUT out; PARTS: Nand(a=a,b=b,out=out); }");
  const wrong = run("hdl", local, fixture("tst"), fixture("cmp"));
  assert.equal(wrong.status, 1, wrong.stderr);
  assert.match(wrong.stderr, /Mismatch/);

  await writeFile(local, "CHIP And { IN a,b; OUT out; PARTS: Nand(a=a,b=b,out=n); Nand(a=n,b=n,out=out); }");
  const correct = run("hdl", local, fixture("tst"), fixture("cmp"));
  assert.equal(correct.status, 0, correct.stderr);
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
  const assembly = run("assemble", "seminar/programs/Add.asm", file("Add.hack"));
  assert.equal(assembly.status, 0, assembly.stderr);
  assert.equal((await readFile(file("Add.hack"), "utf8")).trim().split("\n").length, 6);

  const args = ["hdl", file("Computer.hdl"), "seminar/hardware/ComputerAdd.tst", "seminar/hardware/ComputerAdd.cmp"];
  const chained = run("computer", "Add", file("Computer.hdl"), args[2], args[3]);
  assert.equal(chained.status, 0, chained.stderr);
  const correct = run(...args);
  assert.equal(correct.status, 0, correct.stderr);

  await writeFile(file("CPU.hdl"), builtinOverrides.CPU.replace("out=writeM", "out=disabledWrite").replace("\n    Or(a=negative", "\n    And(a=false,b=false,out=writeM);\n    Or(a=negative"));
  const wrong = run(...args);
  assert.equal(wrong.status, 1, wrong.stderr);
  assert.match(wrong.stderr, /Mismatch/);
});

test("the assembly rehearsal uses the CPU emulator and checks RAM", () => {
  const result = run("cpu", "Add");
  assert.equal(result.status, 0, result.stderr);
});
