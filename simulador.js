
// ============================================
// SIMULADOR RISC-V MONOCICLO
// ============================================

class RISCVSimulator {
  constructor() {
    this.registers = new Array(32).fill(0);
    this.memory = new Array(256).fill(0);
    this.pc = 0;
    this.instructions = [];
    this.labels = {};
    this.running = false;
    this.speed = 800;
    
    this.initUI();
    this.updateRegisters();
    this.updateMemory();
  }

  initUI() {
    document.getElementById('btn-load').addEventListener('click', () => this.loadProgram());
    document.getElementById('btn-step').addEventListener('click', () => this.step());
    document.getElementById('btn-run').addEventListener('click', () => this.run());
    document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    
    const speedSlider = document.getElementById('speed-slider');
    speedSlider.addEventListener('input', (e) => {
      this.speed = parseInt(e.target.value);
      document.getElementById('speed-label').textContent = this.speed + 'ms';
    });
  }

  setStatus(msg, type = 'info') {
    const status = document.getElementById('status');
    status.textContent = msg;
    status.className = `status ${type}`;
  }

  loadProgram() {
    const code = document.getElementById('code-editor').value;
    try {
      const result = this.assemble(code);
      this.instructions = result.instructions;
      this.labels = result.labels;
      this.pc = 0;
      
      this.displayInstructions();
      this.setStatus(`✅ ${this.instructions.length} instrucciones cargadas`, 'success');
      
      document.getElementById('btn-step').disabled = false;
      document.getElementById('btn-run').disabled = false;
      
      this.reset();
    } catch (err) {
      this.setStatus(`❌ Error: ${err.message}`, 'error');
    }
  }

  assemble(code) {
    const lines = code.split('\n');
    const instructions = [];
    const labels = {};
    let address = 0;

    // Primera pasada: registrar etiquetas
    lines.forEach(line => {
      line = line.trim().split('#')[0].trim();
      if (!line) return;
      
      if (line.endsWith(':')) {
        const label = line.slice(0, -1);
        labels[label] = address;
      } else {
        address += 4;
      }
    });

    // Segunda pasada: ensamblar instrucciones
    address = 0;
    lines.forEach(line => {
      line = line.trim().split('#')[0].trim();
      if (!line || line.endsWith(':')) return;

      const inst = this.parseInstruction(line, address, labels);
      if (inst) {
        inst.address = address;
        inst.text = line;
        instructions.push(inst);
        address += 4;
      }
    });

    return { instructions, labels };
  }

  parseInstruction(line, address, labels) {
    const parts = line.replace(/,/g, '').split(/\s+/).filter(p => p);
    const op = parts[0].toLowerCase();

    const getReg = (r) => {
      if (!r) return 0;
      r = r.toLowerCase().trim();
      if (r.startsWith('x')) return parseInt(r.substring(1));
      const map = {zero:0,ra:1,sp:2,gp:3,tp:4,t0:5,t1:6,t2:7,s0:8,s1:9,fp:8,
                   a0:10,a1:11,a2:12,a3:13,a4:14,a5:15,a6:16,a7:17,
                   s2:18,s3:19,s4:20,s5:21,s6:22,s7:23,s8:24,s9:25,
                   s10:26,s11:27,t3:28,t4:29,t5:30,t6:31};
      return map[r] !== undefined ? map[r] : parseInt(r);
    };

    const getImm = (s) => {
      if (!s) return 0;
      s = s.trim();
      if (labels[s] !== undefined) {
        return labels[s] - address;
      }
      // Soportar hexadecimal y binario
      if (s.startsWith('0x')) return parseInt(s, 16);
      if (s.startsWith('0b')) return parseInt(s.substring(2), 2);
      return parseInt(s);
    };

    // Tipo R
    if (['add', 'sub', 'and', 'or', 'xor', 'sll', 'srl', 'sra', 'slt', 'sltu'].includes(op)) {
      return {
        type: 'R',
        op: op,
        rd: getReg(parts[1]),
        rs1: getReg(parts[2]),
        rs2: getReg(parts[3])
      };
    }

    // Tipo I (aritméticas)
    if (['addi', 'andi', 'ori', 'xori', 'slti', 'sltiu', 'slli', 'srli', 'srai'].includes(op)) {
      return {
        type: 'I',
        op: op,
        rd: getReg(parts[1]),
        rs1: getReg(parts[2]),
        imm: getImm(parts[3])
      };
    }

    // Load
    if (op === 'lw' || op === 'lb' || op === 'lh' || op === 'lbu' || op === 'lhu' || op === 'li' ) {
      const match = parts[2].match(/(-?\d+)\((\w+)\)/);
      if (!match) {
        throw new Error(`Formato inválido en ${op}: ${line}`);
      }
      return {
        type: 'I',
        op: 'lw',
        rd: getReg(parts[1]),
        rs1: getReg(match[2]),
        imm: parseInt(match[1])
      };
    }

    // Store
    if (op === 'sw' || op === 'sb' || op === 'sh') {
      const match = parts[2].match(/(-?\d+)\((\w+)\)/);
      if (!match) {
        throw new Error(`Formato inválido en ${op}: ${line}`);
      }
      return {
        type: 'S',
        op: 'sw',
        rs1: getReg(match[2]),
        rs2: getReg(parts[1]),
        imm: parseInt(match[1])
      };
    }

    // Branch
    if (['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu'].includes(op)) {
      return {
        type: 'B',
        op: op,
        rs1: getReg(parts[1]),
        rs2: getReg(parts[2]),
        imm: getImm(parts[3])
      };
    }

    throw new Error(`Instrucción no soportada: ${op}. Solo se soportan tipos R, I, S, Load y Branch`);
  }

  displayInstructions() {
    const list = document.getElementById('instruction-list');
    list.innerHTML = this.instructions.map((inst, i) => 
      `<div class="inst-item" id="inst-${i}">
        <span>${inst.address}:</span>
        <span>${inst.text}</span>
      </div>`
    ).join('');
  }

  updateRegisters() {
    const div = document.getElementById('registers');
    const names = ['zero','ra','sp','gp','tp','t0','t1','t2','s0','s1',
                   'a0','a1','a2','a3','a4','a5','a6','a7',
                   's2','s3','s4','s5','s6','s7','s8','s9',
                   's10','s11','t3','t4','t5','t6'];
    
    div.innerHTML = this.registers.map((val, i) => 
      `<div class="reg-item" id="reg-${i}">
        <span class="reg-name">x${i} (${names[i]})</span>
        <span class="reg-value">${val}</span>
      </div>`
    ).join('');
  }

  updateMemory() {
    const div = document.getElementById('memory-view');
    div.innerHTML = Array.from({length: 16}, (_, i) => {
      const addr = i * 4;
      return `<div class="mem-item" id="mem-${addr}">
        <span class="reg-name">[${addr}]</span>
        <span class="reg-value">${this.memory[addr] || 0}</span>
      </div>`;
    }).join('');
  }

  highlightRegister(reg) {
    document.querySelectorAll('.reg-item').forEach(r => r.classList.remove('highlight'));
    if (reg !== undefined && reg >= 0) {
      document.getElementById(`reg-${reg}`)?.classList.add('highlight');
    }
  }

  async step() {
    // Verificar si ya terminó
    if (this.pc < 0 || this.pc >= this.instructions.length * 4) {
      this.setStatus('🏁 Programa finalizado', 'success');
      this.running = false;
      document.getElementById('btn-step').disabled = true;
      document.getElementById('btn-run').disabled = true;
      return;
    }

    const instIndex = this.pc / 4;
    const inst = this.instructions[instIndex];
    
    if (!inst) {
      this.setStatus('❌ No hay instrucción en PC=' + this.pc, 'error');
      this.running = false;
      return;
    }

    // Highlight current instruction
    document.querySelectorAll('.inst-item').forEach(i => i.classList.remove('current'));
    document.getElementById(`inst-${instIndex}`)?.classList.add('current');

    this.setStatus(`⚙️ Ejecutando [PC=${this.pc}]: ${inst.text}`, 'info');

    await this.executeInstruction(inst);
    
    this.updateRegisters();
    this.updateMemory();

    // Verificar si el programa se detuvo (por bucle infinito detectado)
    if (!this.running) {
      document.getElementById('btn-step').disabled = true;
      document.getElementById('btn-run').disabled = true;
    }
  }

  async executeInstruction(inst) {
    await this.resetWires();

    // FETCH
    await this.animateDatapath(['w_pc_out', 'w_pc_mem', 'w_pc4_out', 'w_purple']);
    
    // DECODE
    await this.animate('w_opcode');
    this.activateComponent('control_unit');

    try {
      switch (inst.type) {
        case 'R':
          await this.executeRType(inst);
          break;
        case 'I':
          if (inst.op === 'lw') {
            await this.executeLW(inst);
          } else {
            await this.executeIType(inst);
          }
          break;
        case 'S':
          await this.executeSW(inst);
          break;
        case 'B':
          await this.executeBranch(inst);
          break;
        default:
          throw new Error(`Tipo de instrucción no soportado: ${inst.type}`);
      }
    } catch (err) {
      this.setStatus(`❌ Error ejecutando: ${err.message}`, 'error');
      this.running = false;
    }

    this.deactivateComponent('control_unit');
  }

  async executeRType(inst) {
    await this.animateDatapath(['w_ctrl_reg_write', 'w_ctrl_reg_dst', 'w_ctrl_alu_src']);
    
    await this.animate('w_rs1');
    await this.animate('w_rs2');
    
    this.activateComponent('reg_file');
    await this.animate('w_inst_11_7_mux');
    await this.animate('w_mux_dst_out');
    
    await this.animate('w_rs1_dat');
    await this.animate('w_rs2_dat');
    await this.animate('w_mux_alu_out');
    
    this.activateComponent('alu');
    const result = this.computeALU(inst.op, this.registers[inst.rs1], this.registers[inst.rs2]);
    
    await this.animate('w_alu_res');
    await this.animate('w_alu_bypass');
    await this.animate('w_wb1_out');
    await this.animate('w_wb2_out');
    
    this.registers[inst.rd] = result;
    this.registers[0] = 0;
    this.highlightRegister(inst.rd);
    
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    
    await this.animateDatapath(['w_pc4_loop', 'w_pc_in']);
    this.pc += 4;
  }

  async executeIType(inst) {
    await this.animateDatapath(['w_ctrl_reg_write', 'w_ctrl_reg_dst', 'w_ctrl_alu_src']);
    
    await this.animate('w_rs1');
    await this.animate('w_imm');
    
    this.activateComponent('sign_ext');
    await this.animate('w_inst_20_16_mux');
    await this.animate('w_mux_dst_out');
    await this.animate('w_imm_alu');
    
    this.activateComponent('reg_file');
    await this.animate('w_rs1_dat');
    await this.animate('w_mux_alu_out');
    
    this.activateComponent('alu');
    const result = this.computeALU(inst.op, this.registers[inst.rs1], inst.imm);
    
    await this.animate('w_alu_res');
    await this.animate('w_alu_bypass');
    await this.animate('w_wb1_out');
    await this.animate('w_wb2_out');
    
    this.registers[inst.rd] = result;
    this.registers[0] = 0;
    this.highlightRegister(inst.rd);
    
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    this.deactivateComponent('sign_ext');
    
    await this.animateDatapath(['w_pc4_loop', 'w_pc_in']);
    this.pc += 4;
  }

  async executeLW(inst) {
    await this.animateDatapath(['w_ctrl_reg_write', 'w_ctrl_reg_dst', 'w_ctrl_alu_src']);
    
    await this.animate('w_rs1');
    await this.animate('w_imm');
    await this.animate('w_inst_20_16_mux');
    await this.animate('w_mux_dst_out');
    await this.animate('w_imm_alu');
    
    this.activateComponent('reg_file');
    await this.animate('w_rs1_dat');
    await this.animate('w_mux_alu_out');
    
    this.activateComponent('alu');
    const addr = this.registers[inst.rs1] + inst.imm;
    await this.animate('w_alu_res');
    
    this.activateComponent('data_mem');
    const data = this.memory[addr] || 0;
    await this.animate('w_mem_read_data');
    await this.animate('w_wb1_out');
    await this.animate('w_wb2_out');
    
    this.registers[inst.rd] = data;
    this.registers[0] = 0;
    this.highlightRegister(inst.rd);
    
    this.deactivateComponent('data_mem');
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    
    await this.animateDatapath(['w_pc4_loop', 'w_pc_in']);
    this.pc += 4;
  }

  async executeSW(inst) {
    await this.animateDatapath(['w_ctrl_mem_write', 'w_ctrl_alu_src']);
    
    await this.animate('w_rs1');
    await this.animate('w_rs2');
    await this.animate('w_imm');
    await this.animate('w_imm_alu');
    
    this.activateComponent('reg_file');
    await this.animate('w_rs1_dat');
    await this.animate('w_mux_alu_out');
    
    this.activateComponent('alu');
    const addr = this.registers[inst.rs1] + inst.imm;
    await this.animate('w_alu_res');
    
    await this.animate('w_rs2_dat');
    await this.animate('w_mem_write_data');
    
    this.activateComponent('data_mem');
    this.memory[addr] = this.registers[inst.rs2];
    
    this.deactivateComponent('data_mem');
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    
    await this.animateDatapath(['w_pc4_loop', 'w_pc_in']);
    this.pc += 4;
  }

  async executeBranch(inst) {
    await this.animate('w_ctrl_branch');
    
    await this.animate('w_rs1');
    await this.animate('w_rs2');
    
    this.activateComponent('reg_file');
    await this.animate('w_rs1_dat');
    await this.animate('w_rs2_dat');
    
    this.activateComponent('alu');
    const take = this.evaluateBranch(inst.op, this.registers[inst.rs1], this.registers[inst.rs2]);
    
    await this.animate('w_zero');
    this.activateComponent('branch_gates');
    await this.animate('w_and_out');
    
    if (take) {
      const newPC = this.pc + inst.imm;
      // Detectar bucle infinito hacia sí mismo
      if (newPC === this.pc) {
        this.setStatus('⏹️ Bucle infinito detectado - Programa detenido', 'success');
        this.running = false;
        this.pc = this.instructions.length * 4; // Marcar como finalizado
        this.deactivateComponent('branch_gates');
        this.deactivateComponent('alu');
        this.deactivateComponent('reg_file');
        return;
      }
      this.pc = newPC;
    } else {
      this.pc += 4;
    }
    
    await this.animate('w_pc_in');
    
    this.deactivateComponent('branch_gates');
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
  }

  async executeJump(inst) {
    if (inst.op === 'jalr') {
      const newPC = (this.registers[inst.rs1] + inst.imm) & ~1; // Clear LSB
      this.registers[inst.rd] = this.pc + 4;
      this.registers[0] = 0;
      this.pc = newPC;
    } else {
      this.registers[inst.rd] = this.pc + 4;
      this.registers[0] = 0;
      this.pc = this.pc + inst.imm;
    }
    await this.animateDatapath(['w_pc_in']);
  }

  computeALU(op, a, b) {
    switch(op) {
      case 'add': case 'addi': return (a + b) | 0;
      case 'sub': return (a - b) | 0;
      case 'and': case 'andi': return a & b;
      case 'or': case 'ori': return a | b;
      case 'xor': case 'xori': return a ^ b;
      case 'sll': case 'slli': return a << (b & 0x1F);
      case 'srl': case 'srli': return a >>> (b & 0x1F);
      case 'sra': case 'srai': return a >> (b & 0x1F);
      case 'slt': case 'slti': return a < b ? 1 : 0;
      case 'sltu': case 'sltiu': return (a >>> 0) < (b >>> 0) ? 1 : 0;
      default: return 0;
    }
  }

  evaluateBranch(op, a, b) {
    switch(op) {
      case 'beq': return a === b;
      case 'bne': return a !== b;
      case 'blt': return a < b;
      case 'bge': return a >= b;
      case 'bltu': return (a >>> 0) < (b >>> 0);
      case 'bgeu': return (a >>> 0) >= (b >>> 0);
      default: return false;
    }
  }

  async animateDatapath(wires) {
    for (const wire of wires) {
      await this.animate(wire);
    }
  }

  animate(wireId) {
    return new Promise(resolve => {
      const el = document.getElementById(wireId);
      if (!el) {
        resolve();
        return;
      }
      
      const len = el.getTotalLength ? el.getTotalLength() : 200;
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      el.getBoundingClientRect();
      
      el.classList.add('anim');
      el.style.transition = `stroke-dashoffset ${this.speed * 0.6}ms linear`;
      el.style.strokeDashoffset = '0';
      
      setTimeout(() => {
        el.classList.remove('anim');
        el.classList.add('on');
        el.style.strokeDasharray = '';
        el.style.strokeDashoffset = '';
        el.style.transition = '';
        resolve();
      }, this.speed * 0.6);
    });
  }

  activateComponent(id) {
    document.getElementById(id)?.classList.add('active');
  }

  deactivateComponent(id) {
    document.getElementById(id)?.classList.remove('active');
  }

  async resetWires() {
    return new Promise(resolve => {
      document.querySelectorAll('.cable').forEach(c => {
        c.classList.remove('on', 'anim');
        c.style.strokeDasharray = '';
        c.style.strokeDashoffset = '';
      });
      document.querySelectorAll('.component').forEach(c => {
        c.classList.remove('active');
      });
      setTimeout(resolve, 100);
    });
  }

  async run() {
    if (this.running) {
      this.running = false;
      document.getElementById('btn-run').textContent = '⏯️ Ejecutar';
      return;
    }

    this.running = true;
    document.getElementById('btn-run').textContent = '⏸️ Pausar';
    document.getElementById('btn-step').disabled = true;

    while (this.running && this.pc >= 0 && this.pc < this.instructions.length * 4) {
      await this.step();
      if (!this.running) break; // Si step() detectó fin, salir
      await new Promise(resolve => setTimeout(resolve, this.speed));
    }

    this.running = false;
    document.getElementById('btn-run').textContent = '⏯️ Ejecutar';
    
    if (this.pc >= this.instructions.length * 4) {
      this.setStatus('🏁 Programa finalizado', 'success');
      document.getElementById('btn-step').disabled = true;
      document.getElementById('btn-run').disabled = true;
    } else {
      document.getElementById('btn-step').disabled = false;
    }
  }

  reset() {
    this.running = false;
    this.pc = 0;
    this.registers.fill(0);
    this.memory.fill(0);
    
    this.updateRegisters();
    this.updateMemory();
    this.resetWires();
    
    document.querySelectorAll('.inst-item').forEach(i => i.classList.remove('current'));
    document.getElementById('btn-run').textContent = '⏯️ Ejecutar';
    
    // Rehabilitar botones solo si hay instrucciones cargadas
    const hasInstructions = this.instructions.length > 0;
    document.getElementById('btn-step').disabled = !hasInstructions;
    document.getElementById('btn-run').disabled = !hasInstructions;
    
    this.setStatus('🔄 Simulador reiniciado', 'info');
  }
}
// Inicializar simulador
const sim = new RISCVSimulator();