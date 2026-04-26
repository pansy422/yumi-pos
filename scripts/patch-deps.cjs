#!/usr/bin/env node
/**
 * Parchea fuentes nativas para que compilen con MSVC 2022 / clang nuevo.
 *
 * Caso conocido: @thiagoelg/node-printer 0.6.x usa `_value` sin calificar
 * en una clase template derivada (MemValue : public MemValueBase<Type>).
 * Compiladores modernos exigen `this->_value` por reglas de two-phase
 * name lookup. Este script hace ese reemplazo de forma idempotente.
 */
const fs = require('node:fs')
const path = require('node:path')

const MARKER = '// yumi-pos:patched-msvc'

function patchFile(file, replacements) {
  if (!fs.existsSync(file)) return false
  let src = fs.readFileSync(file, 'utf8')
  if (src.includes(MARKER)) return false
  let changed = false
  for (const [from, to] of replacements) {
    if (src.includes(from)) {
      src = src.split(from).join(to)
      changed = true
    }
  }
  if (changed) {
    src = `${MARKER}\n${src}`
    fs.writeFileSync(file, src)
    console.log('[patch-deps] parcheado:', path.relative(process.cwd(), file))
    return true
  }
  return false
}

const target = path.join(
  process.cwd(),
  'node_modules',
  '@thiagoelg',
  'node-printer',
  'src',
  'node_printer_win.cc',
)

const replacements = [
  ['_value = (Type*)malloc(iSizeKbytes);', 'this->_value = (Type*)malloc(iSizeKbytes);'],
  ['if(_value != NULL)', 'if(this->_value != NULL)'],
  ['::free(_value);', '::free(this->_value);'],
  ['_value = NULL;', 'this->_value = NULL;'],
]

try {
  patchFile(target, replacements)
} catch (err) {
  console.error('[patch-deps] error:', err.message)
}
