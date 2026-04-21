#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const runtime_1 = require("./runtime");
const stdlib_1 = require("./stdlib");
const [cmd, arquivo] = process.argv.slice(2);
if (cmd !== "run" || !arquivo) {
    console.error("Uso: xodo run <arquivo.xo>");
    process.exit(1);
}
const caminhoAbsoluto = path.resolve(arquivo);
if (!fs.existsSync(caminhoAbsoluto)) {
    console.error(`[Xodó] Arquivo não encontrado: ${caminhoAbsoluto}`);
    process.exit(1);
}
const codigo = fs.readFileSync(caminhoAbsoluto, "utf-8");
(async () => {
    try {
        const tokens = new lexer_1.Lexer(codigo).tokenizar();
        const ast = new parser_1.Parser(tokens).parsear();
        const interpretador = new runtime_1.Interpretador();
        (0, stdlib_1.injetarStdlib)(interpretador.global);
        await interpretador.executar(ast);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
})();
