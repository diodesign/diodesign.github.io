import argparse
from datetime import datetime, timezone
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import threading
import time

# Configuration
TEMPLATES_DIR = 'src/templates'
STATIC_DIR = 'src/static'
OUTPUT_DIR = '_site'
BASE_URL = 'https://diodesign.org'
PORT = 8000

SERVER_STOPPING = False


def load_template(name):
    """Loads an HTML template from src/templates/."""
    path = os.path.join(TEMPLATES_DIR, name)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def render_template(template_content, context):
    """Replaces {{ key }} placeholders using a dictionary context."""
    def replace_match(match):
        key = match.group(1).strip()
        return str(context.get(key, ''))

    return re.sub(r'\{\{\s*(.*?)\s*\}\}', replace_match, template_content)


def prepare_output_directory():
    """Clears old generated files inside _site/ while preserving the root directory inode."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Cleaning {OUTPUT_DIR}/...")
    for item in os.listdir(OUTPUT_DIR):
        item_path = os.path.join(OUTPUT_DIR, item)
        try:
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
        except OSError:
            pass


def generate_sitemap():
    """Generates a clean sitemap.xml for the single-page site."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        '  <url>\n'
        f'    <loc>{BASE_URL}/</loc>\n'
        f'    <lastmod>{today}</lastmod>\n'
        '    <priority>1.0</priority>\n'
        '  </url>\n'
        '</urlset>\n'
    )
    with open(os.path.join(OUTPUT_DIR, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write(xml)
    print("Built sitemap.xml")


def generate_llms_txt():
    """Generates a concise llms.txt describing the program and its projects."""
    content = (
        "# the diodesign program\n\n"
        "> Blending systems engineering, AI, and human craft at the foundation of computing.\n\n"
        "The diodesign program is an independent endeavor run by Chris Williams exploring how artificial intelligence and human engineering can work together to innovate at the very base of the computing stack: firmware, hypervisors, operating systems, and chip design.\n\n"
        "## Projects\n\n"
        "- [Diosix](https://diosix.org/): An open-source bare-metal multiprocessor hypervisor written in Zig for 64-bit RISC-V systems.\n"
        "- [Diosix skills](https://github.com/diodesign/diosix-agent-skills): Agent skills for creating, maintaining, and reviewing idiomatic Diosix source code.\n\n"
        "## Contact\n\n"
        "- Email: chrisw@diosix.org\n"
        "- GitHub: https://github.com/diodesign\n"
        "- LinkedIn: https://www.linkedin.com/in/diodesign/\n"
        "- Bluesky: https://bsky.app/profile/diodesign.org\n"
        "- Keybase: https://keybase.io/diodesign\n"
    )
    with open(os.path.join(OUTPUT_DIR, 'llms.txt'), 'w', encoding='utf-8') as f:
        f.write(content)
    print("Built llms.txt")


def get_last_updated_date():
    """Returns the last commit date (or latest local source mtime if dirty) formatted as 'Mmm DD, YYYY'."""
    try:
        status = subprocess.run(
            ['git', 'status', '--porcelain', 'src', 'build.py'],
            capture_output=True, text=True, check=True
        ).stdout.strip()
        if status:
            mtimes = get_file_mtimes()
            if mtimes:
                dt = datetime.fromtimestamp(max(mtimes.values()))
                return dt.strftime('%b %d, %Y')
        commit_ts = subprocess.run(
            ['git', 'log', '-1', '--format=%ct'],
            capture_output=True, text=True, check=True
        ).stdout.strip()
        if commit_ts:
            dt = datetime.fromtimestamp(int(commit_ts), tz=timezone.utc)
            return dt.strftime('%b %d, %Y')
    except Exception:
        pass
    return datetime.now(timezone.utc).strftime('%b %d, %Y')


def build_site():
    """Builds the complete single-page site into _site/."""
    prepare_output_directory()

    base_html = load_template('base.html')
    index_body = render_template(load_template('index.html'), {
        'last_updated': get_last_updated_date()
    })
    full_html = render_template(base_html, {
        'title': 'the diodesign program',
        'body_class': 'home-page',
        'body': index_body
    })

    with open(os.path.join(OUTPUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(full_html)
    print("Built index.html")

    if os.path.exists(STATIC_DIR):
        for item in os.listdir(STATIC_DIR):
            s = os.path.join(STATIC_DIR, item)
            d = os.path.join(OUTPUT_DIR, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)
        print(f"Copied static assets from {STATIC_DIR} to {OUTPUT_DIR}")

    generate_sitemap()
    generate_llms_txt()


def get_file_mtimes():
    """Returns a dict of filepath -> mtime for all watched source files."""
    mtimes = {}
    if os.path.exists('src'):
        for root, _, files in os.walk('src'):
            for f in files:
                path = os.path.join(root, f)
                try:
                    mtimes[path] = os.path.getmtime(path)
                except OSError:
                    pass
    if os.path.exists('build.py'):
        try:
            mtimes['build.py'] = os.path.getmtime('build.py')
        except OSError:
            pass
    return mtimes


class DevServerHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler serving _site/ with no-cache headers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=OUTPUT_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


class ThreadingDevServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def run_server():
    """Runs the persistent development server and rebuilds on file changes."""
    global SERVER_STOPPING
    build_site()

    print(f"\nStarting development server on port {PORT}...")
    httpd = ThreadingDevServer(("", PORT), DevServerHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    print(f"Dev server running at: http://localhost:{PORT}/ (cache disabled, auto-rebuild on save)")

    last_mtimes = get_file_mtimes()
    try:
        while True:
            time.sleep(0.4)
            current_mtimes = get_file_mtimes()
            if current_mtimes != last_mtimes:
                print("\nChange detected! Rebuilding site...")
                try:
                    subprocess.run([sys.executable, 'build.py'], check=True)
                    print("Rebuild complete.")
                except Exception as e:
                    print(f"Error during build: {e}")
                last_mtimes = get_file_mtimes()
    except KeyboardInterrupt:
        print("\nStopping development server...")
        SERVER_STOPPING = True
        httpd.shutdown()
        httpd.server_close()


def run_tests(verbose=False):
    """Verifies RV32I/RV64I assembly, 32-bit hex encodings, bit-fields, and disassembly against llvm-mc."""
    r_ops_base = ['add', 'sub', 'sll', 'slt', 'sltu', 'xor', 'srl', 'sra', 'or', 'and']
    r_ops_64 = ['addw', 'subw', 'sllw', 'srlw', 'sraw']
    i_ops_base = ['addi', 'slti', 'sltiu', 'xori', 'ori', 'andi', 'slli', 'srli', 'srai']
    i_ops_64 = ['addiw', 'slliw', 'srliw', 'sraiw']
    loads_base = ['lb', 'lh', 'lw', 'lbu', 'lhu']
    loads_64 = ['lwu', 'ld']
    stores_base = ['sb', 'sh', 'sw']
    stores_64 = ['sd']
    branches = ['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu']
    u_ops = ['lui', 'auipc']

    regs = ['x0', 'x1', 'x2']
    imms_signed = [-1, 0, 1]
    imms_unsigned = [0, 1]
    branch_imms = [-2, 0, 2, 4]

    test_cases = []
    # 1. R-Type (RV32I & RV64I)
    for m in r_ops_base + r_ops_64:
        xlen = 64 if m in r_ops_64 else 32
        for rd in ['x1', 'x2']:
            for rs1 in ['x1', 'x2']:
                for rs2 in regs:
                    test_cases.append({'asm': f"{m} {rd}, {rs1}, {rs2}", 'xlen': xlen})

    # 2. I-Type ALU (RV32I & RV64I)
    shift_ops = {'slli', 'srli', 'srai', 'slliw', 'srliw', 'sraiw'}
    for m in i_ops_base + i_ops_64:
        xlen = 64 if m in i_ops_64 else 32
        imm_list = imms_unsigned if m in shift_ops else imms_signed
        for rd in ['x1', 'x2']:
            for rs1 in regs:
                for imm in imm_list:
                    test_cases.append({'asm': f"{m} {rd}, {rs1}, {imm}", 'xlen': xlen})

    # 3. Loads & JALR
    for m in loads_base + loads_64 + ['jalr']:
        xlen = 64 if m in loads_64 else 32
        for rd in ['x1', 'x2']:
            for rs1 in ['x1', 'x2']:
                for imm in imms_signed:
                    test_cases.append({'asm': f"{m} {rd}, {imm}({rs1})", 'xlen': xlen})

    # 4. Stores
    for m in stores_base + stores_64:
        xlen = 64 if m in stores_64 else 32
        for rs2 in regs:
            for rs1 in ['x1', 'x2']:
                for imm in imms_signed:
                    test_cases.append({'asm': f"{m} {rs2}, {imm}({rs1})", 'xlen': xlen})

    # 5. Branches
    for m in branches:
        for rs1 in ['x1', 'x2']:
            for rs2 in ['x0', 'x2']:
                for imm in branch_imms:
                    test_cases.append({'asm': f"{m} {rs1}, {rs2}, {imm}", 'xlen': 64})

    # 6. U-Type (LUI, AUIPC) & J-Type (JAL)
    for m in u_ops:
        for rd in ['x1', 'x2']:
            for imm in imms_unsigned:
                test_cases.append({'asm': f"{m} {rd}, 0x{imm:x}", 'xlen': 64})
    for rd in ['x1', 'x2']:
        for imm in branch_imms:
            test_cases.append({'asm': f"jal {rd}, {imm}", 'xlen': 64})

    # Query llvm-mc for authoritative 32-bit encodings
    asm_input = "\n".join(tc['asm'] for tc in test_cases) + "\n"
    proc = subprocess.run(
        ['llvm-mc', '-triple=riscv64', '-M', 'no-aliases', '-M', 'numeric', '--show-encoding'],
        input=asm_input, text=True, capture_output=True, check=True
    )

    enc_lines = [line for line in proc.stdout.splitlines() if '# encoding:' in line]
    if len(enc_lines) != len(test_cases):
        print(f"Mismatch in llvm-mc output line count: {len(enc_lines)} vs {len(test_cases)}")
        sys.exit(1)

    for tc, line in zip(test_cases, enc_lines):
        m = re.search(r'\[0x([0-9a-fA-F]{2}),0x([0-9a-fA-F]{2}),0x([0-9a-fA-F]{2}),0x([0-9a-fA-F]{2})\]', line)
        b0, b1, b2, b3 = (int(m.group(i), 16) for i in range(1, 5))
        tc['word'] = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
        tc['bytes'] = f"0x{b0:02x} 0x{b1:02x} 0x{b2:02x} 0x{b3:02x}"

    # 7. Walking-1s bit-flip vectors across all 6 instruction formats (R, I, S, B, U, J)
    bit_walk_bases = [
        (0x00000033, list(range(7, 12)) + list(range(15, 25))),  # R-Type: add
        (0x00000013, list(range(7, 12)) + list(range(15, 32))),  # I-Type: addi
        (0x00003023, list(range(7, 12)) + list(range(15, 32))),  # S-Type: sd
        (0x00000063, list(range(7, 12)) + list(range(15, 32))),  # B-Type: beq
        (0x00000037, list(range(7, 32))),                        # U-Type: lui
        (0x0000006f, list(range(7, 32))),                        # J-Type: jal
    ]
    for base_word, bits in bit_walk_bases:
        for b in bits:
            w = base_word ^ (1 << b)
            b0, b1, b2, b3 = w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, (w >> 24) & 0xff
            test_cases.append({
                'asm': None,
                'xlen': 64,
                'word': w,
                'bytes': f"0x{b0:02x} 0x{b1:02x} 0x{b2:02x} 0x{b3:02x}",
                'bit_walk': b
            })

    # Query llvm-mc --disassemble on all 32-bit words to verify round-trip disassembly
    dis_input = "\n".join(tc['bytes'] for tc in test_cases) + "\n"
    dis_proc = subprocess.run(
        ['llvm-mc', '-triple=riscv64', '-M', 'no-aliases', '-M', 'numeric', '--disassemble'],
        input=dis_input, text=True, capture_output=True, check=True
    )
    dis_lines = [
        re.sub(r'\s+', ' ', line.strip().replace('\t', ' '))
        for line in dis_proc.stdout.splitlines()
        if line.strip() and not line.strip().startswith('.')
    ]
    for tc, dline in zip(test_cases, dis_lines):
        tc['llvm_dis'] = dline

    # Run Node.js verification against src/static/splash.js
    node_script = r"""
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('src/static/splash.js', 'utf8');
const startIdx = code.indexOf('const ABI_NAMES =');
const endIdx = code.indexOf('function setupRiscvExplorer()');
const riscvCode = code.slice(startIdx, endIdx);

const sandbox = { BigInt };
vm.createContext(sandbox);
vm.runInContext(riscvCode, sandbox);

const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
const cases = payload.cases;
const verbose = payload.verbose;
let passed = 0;
let failed = 0;
const failures = [];
const details = [];

function normalizeAsm(s) {
    return s.trim().replace(/\s+/g, ' ').replace(/0x([0-9a-fA-F]+)/g, (_, h) => String(parseInt(h, 16)));
}

for (const tc of cases) {
    const w = tc.word >>> 0;
    const hexStr = '0x' + w.toString(16).padStart(8, '0');
    const asmSource = tc.asm || tc.llvm_dis;
    const assembled = sandbox.assembleRiscv(asmSource);
    const assembledFromHex = sandbox.assembleRiscv(hexStr);
    const decoded = sandbox.decodeRiscv(w, tc.xlen);

    // 1. Check 32-bit hex & bit-for-bit encoding match
    const encMatch = (assembled === w) && (assembledFromHex === w);
    let bitMatch = true;
    for (let b = 0; b < 32; b++) {
        if (((assembled >>> b) & 1) !== ((w >>> b) & 1)) {
            bitMatch = false;
            break;
        }
    }

    // 2. Check decoded bitfields match hardware instruction bits [31:0]
    const fieldsMatch = (
        decoded.u === w &&
        decoded.opcode === (w & 0x7f) &&
        decoded.rd === ((w >>> 7) & 0x1f) &&
        decoded.funct3 === ((w >>> 12) & 0x7) &&
        decoded.rs1 === ((w >>> 15) & 0x1f) &&
        decoded.rs2 === ((w >>> 20) & 0x1f) &&
        decoded.funct7 === ((w >>> 25) & 0x7f)
    );

    // 3. Check all 32 bits have valid field classifications
    let bitTypesValid = true;
    for (let b = 0; b < 32; b++) {
        const ft = sandbox.getBitFieldType(b, decoded.fmt);
        if (!['opcode', 'rd', 'funct3', 'rs1', 'rs2', 'funct7', 'imm'].includes(ft)) {
            bitTypesValid = false;
        }
    }

    // 4. Check decoded assembly matches both input asm and llvm-mc --disassemble
    const decMatch = (
        normalizeAsm(decoded.asm) === normalizeAsm(asmSource) &&
        normalizeAsm(decoded.asm) === normalizeAsm(tc.llvm_dis)
    );

    // 5. Check round-trip re-assembly of decoded instruction
    const reassembled = sandbox.assembleRiscv(decoded.asm);
    const roundTripMatch = (reassembled === w);

    const ok = encMatch && bitMatch && fieldsMatch && bitTypesValid && decMatch && roundTripMatch;
    if (ok) {
        passed++;
    } else {
        failed++;
        failures.push({
            asm: tc.asm,
            expectedHex: hexStr,
            assembledHex: assembled !== null ? '0x' + assembled.toString(16).padStart(8, '0') : null,
            decodedAsm: decoded.asm,
            llvmDis: tc.llvm_dis
        });
    }

    if (verbose) {
        const bin = w.toString(2).padStart(32, '0');
        const bitSlices = `${bin.slice(0,7)}_${bin.slice(7,12)}_${bin.slice(12,17)}_${bin.slice(17,20)}_${bin.slice(20,25)}_${bin.slice(25,32)}`;
        const immDisp = decoded.fmt === 'U-type'
            ? `0x${((w & 0xfffff000) >>> 0).toString(16)}`
            : `${decoded.immVal >= 0 ? '+' : ''}${decoded.immVal}`;
        details.push({
            ok,
            xlen: `RV${tc.xlen}I`,
            mode: tc.bit_walk !== undefined ? `bit[${tc.bit_walk}]` : 'asm/hex',
            asm: decoded.asm,
            hex: hexStr,
            bits: bitSlices,
            fmt: decoded.fmt,
            op: decoded.opName,
            alu: decoded.aluOp,
            imm: immDisp,
            wb: `${decoded.wbText}=${decoded.wbVal}`
        });
    }
}

console.log(JSON.stringify({ total: cases.length, passed, failed, failures: failures.slice(0, 10), details }));
process.exitCode = failed > 0 ? 1 : 0;
"""
    node_proc = subprocess.run(
        ['node', '-e', node_script],
        input=json.dumps({'cases': test_cases, 'verbose': verbose}), text=True, capture_output=True
    )
    if node_proc.stdout:
        res = json.loads(node_proc.stdout.strip())
        if verbose and res.get('details'):
            hdr = (
                f"{'STATUS':<6}  {'ISA':<5}  {'MODE':<7}  {'INSTRUCTION':<22}  "
                f"{'HEX':<10}  {'BITS [31:25]_[24:20]_[19:15]_[14:12]_[11:7]_[6:0]':<39}  "
                f"{'FMT':<7}  {'ALU':<8}  {'IMM':<10}  {'RESULT'}"
            )
            print(hdr)
            print("-" * len(hdr))
            for d in res['details']:
                st = "PASS" if d['ok'] else "FAIL"
                print(
                    f"{st:<6}  {d['xlen']:<5}  {d['mode']:<7}  {d['asm']:<22}  "
                    f"{d['hex']:<10}  {d['bits']:<39}  "
                    f"{d['fmt']:<7}  {d['alu']:<8}  {d['imm']:<10}  {d['wb']}"
                )
            print("-" * len(hdr))
        print(f"RISC-V Verification Suite (llvm-mc + Node.js):")
        print(f"  Total instruction/register/immediate vectors tested: {res['total']}")
        print(f"  Passed (32-bit hex, bit-fields [31:0], & disassembly): {res['passed']}/{res['total']}")
        if res['failed'] > 0:
            print("  Failures:", json.dumps(res['failures'], indent=2))
            sys.exit(1)
        print("  All RV32I & RV64I instruction tests PASSED!")
    else:
        print("Node test error:", node_proc.stderr)
        sys.exit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Build the diodesign single-page website.')
    parser.add_argument('--server', action='store_true', help='Start a local dev server and watch for changes.')
    parser.add_argument('--clear', action='store_true', help='Clear the generated _site/ directory.')
    parser.add_argument('--test', action='store_true', help='Run automated RV32I/RV64I verification against llvm-mc.')
    parser.add_argument('-v', '--verbose', action='store_true', help='Print verbose per-instruction decode and datapath table during --test.')
    args = parser.parse_args()

    if args.clear:
        if os.path.exists(OUTPUT_DIR):
            shutil.rmtree(OUTPUT_DIR)
            print(f"Removed {OUTPUT_DIR}/.")
    elif args.test:
        run_tests(verbose=args.verbose)
    elif args.server:
        run_server()
    else:
        build_site()
