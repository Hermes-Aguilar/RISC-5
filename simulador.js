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
    await this.resetWires();
    
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

    document.querySelectorAll('.inst-item').forEach(i => i.classList.remove('current'));
    document.getElementById(`inst-${instIndex}`)?.classList.add('current');

    this.setStatus(`⚙️ Ejecutando [PC=${this.pc}]: ${inst.text}`, 'info');

    await this.executeInstruction(inst);
    
    this.updateRegisters();
    this.updateMemory();

    if (!this.running) {
      document.getElementById('btn-step').disabled = true;
      document.getElementById('btn-run').disabled = true;
    }
  }

  async executeInstruction(inst) {
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
  }

  async executeRType(inst) {
    // =============================================
    // FLUJO PARA INSTRUCCIONES TIPO R (add, sub, and, or, etc)
    // =============================================
    
    // PASO 1: FETCH - Leer PC y buscar instrucción en memoria
    this.setStatus(`📍 FETCH: Leyendo PC=${this.pc}`, 'info');
    await this.animate('cable_pc_to_mem');
    this.activateComponent('im_mem');
    await this.sleep(300);
    
    // PASO 2: PC+4 - Calcular siguiente PC
    this.setStatus(`➕ Calculando PC+4`, 'info');
    await this.animate('cable_pc_to_adder'); // PC va al sumador
    // Cable con constante "4" está conectado permanentemente al sumador
    this.activateComponent('adder_pc4');
    // El resultado PC+4 se queda en el sumador, no lo enviamos todavía
    await this.sleep(300);
    
    // PASO 3: DECODE - Extraer campos de la instrucción (rs1, rs2, rd)
    this.setStatus(`🔍 DECODE: Extrayendo campos rs1=${inst.rs1}, rs2=${inst.rs2}, rd=${inst.rd}`, 'info');
    await this.animate('cable_mem_to_reg_ad');
    await this.animate('cable_mem_to_a1');
    await this.animate('cable_mem_to_a2');
    await this.sleep(300);
    
    // PASO 4: Activar Unidad de Control
    this.setStatus(`⚙️ Unidad de Control: Tipo R`, 'info');
    this.activateComponent('control_unit');
    await this.animate('cable_cu_to_rf_we');
    await this.animate('cable_cu_to_mux_alu_ctrl');
    await this.animate('cable_cu_to_alu_ctrl'); // Control de operación ALU
    await this.sleep(300);
    
    // PASO 5: READ - Leer registros rs1 y rs2
    this.setStatus(`📖 READ: Leyendo x${inst.rs1}=${this.registers[inst.rs1]}, x${inst.rs2}=${this.registers[inst.rs2]}`, 'info');
    this.activateComponent('reg_file');
    await this.animate('cable_reg_d1_to_mux_alu');
    await this.animate('cable_reg_d2_to_alu');
    await this.sleep(300);
    
    // PASO 6: MUX ALU - Seleccionar segundo operando (registro para tipo R)
    this.setStatus(`🔀 MUX: Seleccionando rs2 para ALU`, 'info');
    this.activateComponent('mux_alu');
    await this.animate('cable_mux_alu_to_alu');
    this.deactivateComponent('mux_alu');
    await this.sleep(300);
    
    // PASO 7: EXECUTE - Operación en la ALU
    const result = this.computeALU(inst.op, this.registers[inst.rs1], this.registers[inst.rs2]);
    this.setStatus(`🔢 EXECUTE: ${inst.op.toUpperCase()} → resultado=${result}`, 'info');
    this.activateComponent('alu');
    await this.animate('cable_alu_to_dm');
    await this.sleep(300);
    
    // PASO 8: MUX WB - Seleccionar dato a escribir (resultado ALU para tipo R)
    this.setStatus(`🔀 MUX WB: Seleccionando resultado ALU`, 'info');
    await this.animate('cable_mux5_to_alu'); // Cable del pin 50 que conecta ALU al MUX
    this.activateComponent('mux_wb2');
    await this.animate('cable_mux5_to_rf_di');
    this.deactivateComponent('mux_wb2');
    await this.sleep(300);
    
    // PASO 9: WRITE BACK - Escribir resultado en rd
    this.setStatus(`✍️ WRITE BACK: Escribiendo ${result} en x${inst.rd}`, 'info');
    this.registers[inst.rd] = result;
    this.registers[0] = 0;
    this.highlightRegister(inst.rd);
    await this.sleep(300);
    
    // PASO 10: Actualizar PC - MUX selecciona PC+4 y actualiza
    this.setStatus(`✅ Actualizando PC con PC+4`, 'info');
    this.activateComponent('mux_pc');
    await this.animate('cable_mux_to_adder_right'); // MUX selecciona entrada 0 (PC+4)
    await this.animate('cable_adder_to_pc'); // Salida del MUX al PC
    this.deactivateComponent('mux_pc');
    this.pc += 4;
    
    // Cleanup
    this.deactivateComponent('adder_pc4');
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    this.deactivateComponent('im_mem');
    this.deactivateComponent('control_unit');
  }

  async executeIType(inst) {
    // =============================================
    // FLUJO PARA INSTRUCCIONES TIPO I (addi, andi, ori, etc)
    // =============================================
    
    // PASO 1: FETCH - Leer PC y buscar instrucción en memoria
    this.setStatus(`📍 FETCH: Leyendo PC=${this.pc}`, 'info');
    await this.animate('cable_pc_to_mem');
    this.activateComponent('im_mem');
    await this.sleep(300);
    
    // PASO 2: PC+4 - Calcular siguiente PC
    this.setStatus(`➕ Calculando PC+4`, 'info');
    await this.animate('cable_pc_to_adder'); // PC va al sumador
    // Cable con constante "4" está conectado permanentemente al sumador
    this.activateComponent('adder_pc4');
    // El resultado PC+4 se queda en el sumador, no lo enviamos todavía
    await this.sleep(300);
    
    // PASO 3: DECODE - Extraer campos de la instrucción (rs1, rd, imm)
    this.setStatus(`🔍 DECODE: rs1=${inst.rs1}, rd=${inst.rd}, imm=${inst.imm}`, 'info');
    await this.animate('cable_mem_to_reg_ad'); // rd para write back
    await this.animate('cable_mem_to_a1'); // rs1
    // Extraer inmediato para Sign Extend
    await this.animate('cable_mem_to_mux_inst_0'); // Campo superior al MUX inst
    await this.animate('cable_mem_to_mux_inst_1'); // Campo inferior al MUX inst
    await this.sleep(300);
    
    // PASO 4: Activar Unidad de Control
    this.setStatus(`⚙️ Unidad de Control: Tipo I (inmediato)`, 'info');
    this.activateComponent('control_unit');
    await this.animate('cable_cu_to_rf_we');
    await this.animate('cable_cu_to_mux_alu_ctrl');
    await this.animate('cable_cu_to_alu_ctrl'); // Control de operación ALU
    await this.sleep(300);
    
    // PASO 5: Sign Extend - Extender el inmediato
    this.setStatus(`📏 Sign Extend: Extendiendo inmediato=${inst.imm}`, 'info');
    // Primero el MUX inst selecciona qué campo pasar al Sign Extend
    this.activateComponent('mux_inst');
    await this.animate('cable_mux_to_signext'); // Salida del MUX inst
    this.deactivateComponent('mux_inst');
    this.activateComponent('sign_ext');
    await this.animate('cable_signext_to_mux_alu'); // Salida del Sign Extend
    this.deactivateComponent('sign_ext');
    await this.sleep(300);
    
    // PASO 6: READ - Leer registro rs1
    this.setStatus(`📖 READ: Leyendo x${inst.rs1}=${this.registers[inst.rs1]}`, 'info');
    this.activateComponent('reg_file');
    await this.animate('cable_reg_d1_to_mux_alu');
    await this.sleep(300);
    
    // PASO 7: MUX ALU - Seleccionar segundo operando (inmediato para tipo I)
    this.setStatus(`🔀 MUX: Seleccionando inmediato para ALU`, 'info');
    this.activateComponent('mux_alu');
    await this.animate('cable_mux_alu_to_alu');
    this.deactivateComponent('mux_alu');
    await this.sleep(300);
    
    // PASO 8: EXECUTE - Operación en la ALU
    const result = this.computeALU(inst.op, this.registers[inst.rs1], inst.imm);
    this.setStatus(`🔢 EXECUTE: ${inst.op.toUpperCase()} → resultado=${result}`, 'info');
    this.activateComponent('alu');
    await this.animate('cable_alu_to_dm');
    await this.sleep(300);
    
    // PASO 9: MUX WB - Seleccionar dato a escribir (resultado ALU)
    this.setStatus(`🔀 MUX WB: Seleccionando resultado ALU`, 'info');
    await this.animate('cable_mux5_to_alu'); // Cable del pin 50 que conecta ALU al MUX
    this.activateComponent('mux_wb2');
    await this.animate('cable_mux5_to_rf_di');
    this.deactivateComponent('mux_wb2');
    await this.sleep(300);
    
    // PASO 10: WRITE BACK - Escribir resultado en rd
    this.setStatus(`✍️ WRITE BACK: Escribiendo ${result} en x${inst.rd}`, 'info');
    this.registers[inst.rd] = result;
    this.registers[0] = 0;
    this.highlightRegister(inst.rd);
    await this.sleep(300);
    
    // PASO 11: Actualizar PC - MUX selecciona PC+4 y actualiza
    this.setStatus(`✅ Actualizando PC con PC+4`, 'info');
    this.activateComponent('mux_pc');
    await this.animate('cable_mux_to_adder_right'); // MUX selecciona entrada 0 (PC+4)
    await this.animate('cable_adder_to_pc'); // Salida del MUX al PC
    this.deactivateComponent('mux_pc');
    this.pc += 4;
    
    // Cleanup
    this.deactivateComponent('adder_pc4');
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    this.deactivateComponent('im_mem');
    this.deactivateComponent('control_unit');
  }

  async executeLW(inst) {
    // =============================================
    // FLUJO PARA INSTRUCCIONES LOAD (lw)
    // =============================================
    
    // PASO 1: FETCH - Leer PC y buscar instrucción en memoria
    this.setStatus(`📍 FETCH: Leyendo PC=${this.pc}`, 'info');
    await this.animate('cable_pc_to_mem');
    this.activateComponent('im_mem');
    await this.sleep(300);
    
    // PASO 2: PC+4 - Calcular siguiente PC
    this.setStatus(`➕ Calculando PC+4`, 'info');
    await this.animate('cable_pc_to_adder'); // PC va al sumador
    // Cable con constante "4" está conectado permanentemente al sumador
    this.activateComponent('adder_pc4');
    // El resultado PC+4 se queda en el sumador, no lo enviamos todavía
    await this.sleep(300);
    
    // PASO 3: DECODE - Extraer campos (rs1=base, rd=destino, offset=inmediato)
    this.setStatus(`🔍 DECODE: lw x${inst.rd}, ${inst.imm}(x${inst.rs1})`, 'info');
    await this.animate('cable_mem_to_reg_ad'); // rd para write back
    await this.animate('cable_mem_to_a1'); // rs1
    // Extraer inmediato para Sign Extend
    await this.animate('cable_mem_to_mux_inst_0'); // Campo superior al MUX inst
    await this.animate('cable_mem_to_mux_inst_1'); // Campo inferior al MUX inst
    await this.sleep(300);
    
    // PASO 4: Activar Unidad de Control
    this.setStatus(`⚙️ Unidad de Control: LOAD (MemRead=1, MemtoReg=1)`, 'info');
    this.activateComponent('control_unit');
    await this.animate('cable_cu_to_rf_we');
    await this.animate('cable_cu_to_mux_alu_ctrl');
    await this.animate('cable_cu_to_alu_ctrl'); // Control de operación ALU (ADD para dirección)
    await this.animate('cable_cu_to_mux5_ctrl');
    await this.sleep(300);
    
    // PASO 5: Sign Extend - Extender el offset
    this.setStatus(`📏 Sign Extend: Extendiendo offset=${inst.imm}`, 'info');
    // Primero el MUX inst selecciona qué campo pasar al Sign Extend
    this.activateComponent('mux_inst');
    await this.animate('cable_mux_to_signext'); // Salida del MUX inst
    this.deactivateComponent('mux_inst');
    this.activateComponent('sign_ext');
    await this.animate('cable_signext_to_mux_alu'); // Salida del Sign Extend
    this.deactivateComponent('sign_ext');
    await this.sleep(300);
    
    // PASO 6: READ - Leer registro base (rs1)
    this.setStatus(`📖 READ: Leyendo dirección base x${inst.rs1}=${this.registers[inst.rs1]}`, 'info');
    this.activateComponent('reg_file');
    await this.animate('cable_reg_d1_to_mux_alu');
    await this.sleep(300);
    
    // PASO 7: MUX ALU - Seleccionar offset (inmediato)
    this.setStatus(`🔀 MUX: Seleccionando offset para ALU`, 'info');
    this.activateComponent('mux_alu');
    await this.animate('cable_mux_alu_to_alu');
    this.deactivateComponent('mux_alu');
    await this.sleep(300);
    
    // PASO 8: EXECUTE - Calcular dirección efectiva (base + offset)
    const addr = this.registers[inst.rs1] + inst.imm;
    this.setStatus(`🔢 EXECUTE: Dirección efectiva = ${this.registers[inst.rs1]} + ${inst.imm} = ${addr}`, 'info');
    this.activateComponent('alu');
    await this.animate('cable_alu_to_dm');
    await this.sleep(300);
    
    // PASO 9: MEMORY READ - Leer dato de memoria de datos
    this.setStatus(`💾 MEMORY READ: Leyendo dato en dirección [${addr}]`, 'info');
    this.activateComponent('data_mem');
    const data = this.memory[addr] || 0;
    await this.animate('cable_dm_to_mux5');
    await this.sleep(300);
    
    // PASO 10: MUX WB - Seleccionar dato de memoria (MemtoReg=1)
    this.setStatus(`🔀 MUX WB: Seleccionando dato de memoria=${data}`, 'info');
    this.activateComponent('mux_wb2');
    await this.animate('cable_mux5_to_rf_di');
    this.deactivateComponent('mux_wb2');
    await this.sleep(300);
    
    // PASO 11: WRITE BACK - Escribir dato en rd
    this.setStatus(`✍️ WRITE BACK: Escribiendo ${data} en x${inst.rd}`, 'info');
    this.registers[inst.rd] = data;
    this.registers[0] = 0;
    this.highlightRegister(inst.rd);
    await this.sleep(300);
    
    // PASO 12: Actualizar PC - MUX selecciona PC+4 y actualiza
    this.setStatus(`✅ Actualizando PC con PC+4`, 'info');
    this.activateComponent('mux_pc');
    await this.animate('cable_mux_to_adder_right'); // MUX selecciona entrada 0 (PC+4)
    await this.animate('cable_adder_to_pc'); // Salida del MUX al PC
    this.deactivateComponent('mux_pc');
    this.pc += 4;
    
    // Cleanup
    this.deactivateComponent('adder_pc4');
    this.deactivateComponent('data_mem');
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    this.deactivateComponent('im_mem');
    this.deactivateComponent('control_unit');
  }

  async executeSW(inst) {
    // =============================================
    // FLUJO PARA INSTRUCCIONES STORE (sw)
    // =============================================
    
    // PASO 1: FETCH - Leer PC y buscar instrucción en memoria
    this.setStatus(`📍 FETCH: Leyendo PC=${this.pc}`, 'info');
    await this.animate('cable_pc_to_mem');
    this.activateComponent('im_mem');
    await this.sleep(300);
    
    // PASO 2: PC+4 - Calcular siguiente PC
    this.setStatus(`➕ Calculando PC+4`, 'info');
    await this.animate('cable_pc_to_adder'); // PC va al sumador
    // Cable con constante "4" está conectado permanentemente al sumador
    this.activateComponent('adder_pc4');
    // El resultado PC+4 se queda en el sumador, no lo enviamos todavía
    await this.sleep(300);
    
    // PASO 3: DECODE - Extraer campos (rs1=base, rs2=dato, offset=inmediato)
    this.setStatus(`🔍 DECODE: sw x${inst.rs2}, ${inst.imm}(x${inst.rs1})`, 'info');
    await this.animate('cable_mem_to_a1');
    await this.animate('cable_mem_to_a2');
    // Extraer offset para Sign Extend
    await this.animate('cable_mem_to_order_top');
    await this.animate('cable_mem_to_order_bottom');
    await this.sleep(300);
    
    // PASO 4: Activar Unidad de Control
    this.setStatus(`⚙️ Unidad de Control: STORE (MemWrite=1, RegWrite=0)`, 'info');
    this.activateComponent('control_unit');
    await this.animate('cable_cu_to_mux_alu_ctrl');
    await this.animate('cable_cu_to_alu_ctrl'); // Control de operación ALU (ADD para dirección)
    await this.animate('cable_cu_to_dm_we');
    await this.sleep(300);
    
    // PASO 5: Order & Sign Extend - Extender y reordenar el offset de Store
    this.setStatus(`📏 Order & Sign Extend: Procesando offset=${inst.imm}`, 'info');
    this.activateComponent('order_sign_ext');
    await this.animate('cable_order_to_mux');
    this.deactivateComponent('order_sign_ext');
    await this.sleep(300);
    
    // PASO 6: READ - Leer registros rs1 (base) y rs2 (dato a guardar)
    this.setStatus(`📖 READ: Base x${inst.rs1}=${this.registers[inst.rs1]}, Dato x${inst.rs2}=${this.registers[inst.rs2]}`, 'info');
    this.activateComponent('reg_file');
    await this.animate('cable_reg_d1_to_mux_alu');
    await this.animate('cable_reg_d2_to_alu');
    await this.sleep(300);
    
    // PASO 7: MUX ALU - Seleccionar offset (inmediato)
    this.setStatus(`🔀 MUX: Seleccionando offset para calcular dirección`, 'info');
    this.activateComponent('mux_alu');
    await this.animate('cable_mux_alu_to_alu');
    this.deactivateComponent('mux_alu');
    await this.sleep(300);
    
    // PASO 8: EXECUTE - Calcular dirección efectiva (base + offset)
    const addr = this.registers[inst.rs1] + inst.imm;
    this.setStatus(`🔢 EXECUTE: Dirección efectiva = ${this.registers[inst.rs1]} + ${inst.imm} = ${addr}`, 'info');
    this.activateComponent('alu');
    await this.animate('cable_alu_to_dm');
    await this.sleep(300);
    
    // PASO 9: Enviar dato a escribir desde rs2
    this.setStatus(`📤 Enviando dato x${inst.rs2}=${this.registers[inst.rs2]} a memoria`, 'info');
    await this.animate('cable_mem_di');
    await this.sleep(300);
    
    // PASO 10: MEMORY WRITE - Escribir dato en memoria de datos
    this.setStatus(`💾 MEMORY WRITE: Guardando ${this.registers[inst.rs2]} en dirección [${addr}]`, 'info');
    this.activateComponent('data_mem');
    this.memory[addr] = this.registers[inst.rs2];
    this.updateMemory(); // Actualizar vista de memoria
    await this.sleep(300);
    
    // Highlight memoria modificada
    document.getElementById(`mem-${addr}`)?.classList.add('highlight');
    setTimeout(() => {
      document.getElementById(`mem-${addr}`)?.classList.remove('highlight');
    }, 1000);
    
    // PASO 11: Actualizar PC - MUX selecciona PC+4 y actualiza (NO hay write back en registros)
    this.setStatus(`✅ Actualizando PC con PC+4 (sin write-back a registros)`, 'info');
    this.activateComponent('mux_pc');
    await this.animate('cable_mux_to_adder_right'); // MUX selecciona entrada 0 (PC+4)
    await this.animate('cable_adder_to_pc'); // Salida del MUX al PC
    this.deactivateComponent('mux_pc');
    this.pc += 4;
    
    // Cleanup
    this.deactivateComponent('adder_pc4');
    this.deactivateComponent('data_mem');
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    this.deactivateComponent('im_mem');
    this.deactivateComponent('control_unit');
  }

  async executeBranch(inst) {
    // =============================================
    // FLUJO PARA INSTRUCCIONES BRANCH (beq, bne, blt, bge, etc)
    // =============================================
    
    // PASO 1: FETCH - Leer PC y buscar instrucción en memoria
    this.setStatus(`📍 FETCH: Leyendo PC=${this.pc}`, 'info');
    await this.animate('cable_pc_to_mem');
    this.activateComponent('im_mem');
    await this.sleep(300);
    
    // PASO 2: DECODE - Extraer campos (rs1, rs2, offset) desde memoria de instrucciones
    this.setStatus(`🔍 DECODE: ${inst.op} x${inst.rs1}, x${inst.rs2}, offset=${inst.imm}`, 'info');
    await this.animate('cable_mem_to_reg_ad'); // Campo rd/ad
    await this.animate('cable_mem_to_a1'); // rs1
    await this.animate('cable_mem_to_a2'); // rs2
    // Extraer campos para Order & Sign Extend
    await this.animate('cable_mem_to_order_top');
    await this.animate('cable_mem_to_order_bottom');
    await this.sleep(300);
    
    // PASO 3: Activar Unidad de Control
    this.setStatus(`⚙️ Unidad de Control: BRANCH (Branch=1, RegWrite=0)`, 'info');
    this.activateComponent('control_unit');
    await this.animate('cable_cu_to_mux_branch_ctrl');
    await this.animate('cable_cu_to_alu_ctrl'); // Control de operación ALU (SUB para comparación)
    await this.animate('cable_cu_to_and');
    await this.sleep(300);
    
    // PASO 4: Order & Sign Extend - Calcular dirección de branch
    this.setStatus(`📏 Order & Sign Extend: Calculando offset de salto`, 'info');
    this.activateComponent('order_sign_ext');
    await this.animate('cable_order_to_mux');
    this.deactivateComponent('order_sign_ext');
    await this.sleep(300);
    
    // PASO 5: PC+4 - Calcular siguiente PC (por si no se toma el branch)
    this.setStatus(`➕ Calculando PC+4 (alternativa si no salta)`, 'info');
    await this.animate('cable_pc_to_adder'); // PC va al sumador (entrada izquierda)
    // Cable 6: Constante "4" entra al sumador (entrada derecha)
    // Nota: Este cable lleva el valor constante 4 al sumador
    this.activateComponent('adder_pc4');
    // El resultado PC+4 se queda en el sumador hasta decidir si se usa
    await this.sleep(300);
    
    // PASO 6: READ - Leer registros rs1 y rs2 para comparar
    this.setStatus(`📖 READ: Comparando x${inst.rs1}=${this.registers[inst.rs1]} vs x${inst.rs2}=${this.registers[inst.rs2]}`, 'info');
    this.activateComponent('reg_file');
    await this.animate('cable_reg_d1_to_mux_alu');
    await this.animate('cable_reg_d2_to_alu');
    await this.sleep(300);
    
    // PASO 7: MUX ALU - Seleccionar rs2 (registro para comparación)
    this.setStatus(`🔀 MUX ALU: Seleccionando rs2 para comparación`, 'info');
    this.activateComponent('mux_alu');
    await this.animate('cable_mux_alu_to_alu');
    this.deactivateComponent('mux_alu');
    await this.sleep(300);
    
    // PASO 8: EXECUTE - Comparar en la ALU
    const take = this.evaluateBranch(inst.op, this.registers[inst.rs1], this.registers[inst.rs2]);
    this.setStatus(`🔢 EXECUTE: ${inst.op.toUpperCase()} → Condición: ${take ? 'VERDADERA ✓' : 'FALSA ✗'}`, 'info');
    this.activateComponent('alu');
    await this.sleep(300);
    
    // PASO 9: Salida de ALU - Cable que lleva el bit de comparación
    this.setStatus(`📊 Salida ALU: Enviando resultado de comparación`, 'info');
    await this.animate('cable_mux_branch_to_alu'); // Este cable lleva el resultado de ALU hacia branch logic
    await this.sleep(300);
    
    // PASO 10: Lógica de NOT y MUX Branch según tipo de instrucción
    const usesNot = (inst.op === 'bne');
    
    if (usesNot) {
      // Para BNE: invertir la señal zero con NOT gate
      this.setStatus(`🔄 NOT Gate: Invirtiendo señal para BNE`, 'info');
      this.activateComponent('not_gate');
      await this.animate('cable_not_to_alu'); // Entrada al NOT desde ALU
      await this.animate('cable_not_to_mux_branch'); // Salida del NOT al MUX
      this.deactivateComponent('not_gate');
      await this.sleep(300);
    }
    
    // PASO 11: MUX Branch - Seleccionar señal correcta (normal o invertida)
    this.setStatus(`🔀 MUX Branch: Seleccionando señal ${usesNot ? 'invertida' : 'directa'}`, 'info');
    this.activateComponent('mux_branch');
    await this.animate('cable_mux_branch_to_and');
    this.deactivateComponent('mux_branch');
    await this.sleep(300);
    
    // PASO 12: AND Gate - Combinar Branch signal con resultado
    this.setStatus(`🔗 AND Gate: Branch signal=${take}`, 'info');
    this.activateComponent('and_gate');
    await this.animate('cable_and_to_mux_ctrl');
    this.deactivateComponent('and_gate');
    await this.sleep(300);
    
    // PASO 13: MUX PC - Decidir próximo PC
    if (take) {
      const newPC = this.pc + inst.imm;
      
      // Detectar bucle infinito
      if (newPC === this.pc) {
        this.setStatus('⏹️ Bucle infinito detectado - Programa detenido', 'success');
        this.running = false;
        this.pc = this.instructions.length * 4;
        this.deactivateComponent('adder_pc4');
        this.deactivateComponent('alu');
        this.deactivateComponent('reg_file');
        this.deactivateComponent('im_mem');
        this.deactivateComponent('control_unit');
        return;
      }
      
      this.setStatus(`✅ BRANCH TOMADO: PC=${this.pc} → ${newPC}`, 'success');
      this.activateComponent('mux_pc');
      await this.animate('cable_mux_to_adder_right'); // Entrada 1 del MUX (offset de branch)
      await this.animate('cable_adder_to_pc'); // Salida del MUX al PC
      this.deactivateComponent('mux_pc');
      this.pc = newPC;
    } else {
      this.setStatus(`➡️ BRANCH NO TOMADO: PC=${this.pc} → ${this.pc + 4}`, 'info');
      // Cuando NO se toma el branch, usar PC+4 del sumador
      this.activateComponent('mux_pc');
      // El cable del sumador (PC+4) ya está encendido desde el PASO 5
      // Ahora el MUX selecciona entrada 0 (PC+4) y lo pasa al PC
      await this.animate('cable_mux_to_adder_right'); // Entrada del MUX (PC+4 del sumador)
      await this.animate('cable_adder_to_pc'); // Salida del MUX va al PC
      this.deactivateComponent('mux_pc');
      this.pc += 4;
    }
    
    await this.sleep(300);
    
    // Cleanup
    this.deactivateComponent('adder_pc4');
    this.deactivateComponent('alu');
    this.deactivateComponent('reg_file');
    this.deactivateComponent('im_mem');
    this.deactivateComponent('control_unit');
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  animate(cableId) {
    return new Promise(resolve => {
      const el = document.getElementById(cableId);
      if (!el) {
        console.warn(`Cable no encontrado: ${cableId}`);
        resolve();
        return;
      }
      
      const len = el.getTotalLength ? el.getTotalLength() : 200;
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      el.getBoundingClientRect();
      
      el.classList.remove('on');
      el.classList.add('anim');
      el.style.transition = `stroke-dashoffset ${this.speed * 0.4}ms linear`;
      el.style.strokeDashoffset = '0';
      
      setTimeout(() => {
        el.classList.remove('anim');
        el.classList.add('on');
        resolve();
      }, this.speed * 0.4);
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
        c.classList.remove('anim', 'on');
        c.style.opacity = "0.3";
        c.style.strokeWidth = "3px";
        c.style.stroke = "#ffc107";
        c.style.strokeDasharray = "5 5";
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
      if (!this.running) break;
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
    
    const hasInstructions = this.instructions.length > 0;
    document.getElementById('btn-step').disabled = !hasInstructions;
    document.getElementById('btn-run').disabled = !hasInstructions;
    
    this.setStatus('🔄 Simulador reiniciado', 'info');
  }
}

// Inicializar simulador
const sim = new RISCVSimulator();