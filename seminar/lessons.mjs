// Each entry is a ./check command with its arguments.
export const lessons = {
  1: { title: "Boolean Logic", checks: [["hdl", "And"], ["hdl", "Xor"], ["hdl", "Mux"]] },
  2: { title: "Boolean Arithmetic", checks: [["hdl", "HalfAdder"], ["hdl", "FullAdder"], ["hdl", "Add16"], ["hdl", "ALU"]] },
  3: { title: "Sequential Logic", checks: [["hdl", "Bit"], ["hdl", "Register"], ["hdl", "PC"]] },
  4: { title: "Hack Assembly", checks: [["cpu", "Add"]] },
  5: { title: "CPU", checks: [["hdl", "CPU"]] },
  6: { title: "Computer", checks: [["computer", "Add"]] },
};
