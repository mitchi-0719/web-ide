const hdl = (...chips) => chips.map((chip) => ["hdl", chip]);

// Each check is a ./check command with its arguments.
export const lessons = {
  1: {
    title: "Boolean Logic",
    checks: hdl("Not", "And", "Or", "Xor", "Mux", "DMux", "Not16", "And16", "Or16",
      "Mux16", "Or8Way", "Mux4Way16", "Mux8Way16", "DMux4Way", "DMux8Way"),
  },
  2: { title: "Boolean Arithmetic", checks: hdl("HalfAdder", "FullAdder", "Add16", "Inc16", "ALU") },
  3: { title: "Sequential Logic", checks: hdl("Bit", "Register", "PC", "RAM8", "RAM64", "RAM512", "RAM4K", "RAM16K") },
  4: { title: "Hack Assembly", checks: [["cpu", "Add"], ["cpu", "Mult"], ["cpu", "Fill"]] },
  5: { title: "CPU", checks: [["hdl", "CPU"]] },
  6: { title: "Computer", checks: [["hdl", "Memory"], ["computer", "Add"]] },
};
