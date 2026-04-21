#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { Lexer }         from "./lexer";
import { Parser }        from "./parser";
import { Interpretador } from "./runtime";
import { injetarStdlib } from "./stdlib";

const args = process.argv.slice(2);
const isDebug = args.includes("--debug");
const filteredArgs = args.filter(a => a !== "--debug");

const [cmd, arquivo] = filteredArgs;

if (cmd !== "run" || !arquivo) {
    console.error("Uso: xodo run <arquivo.xo> [--debug]");
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
        const tokens       = new Lexer(codigo).tokenizar();
        const ast          = new Parser(tokens).parsear();
        const interpretador = new Interpretador();
        injetarStdlib(interpretador.global);
        
        if (isDebug) {
            interpretador.debugMode = true;
            interpretador.onPasso = (linha) => {
                console.log(`DEBUG_LINE:${linha}`);
            };
        }

        await interpretador.executar(ast);
    } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
    }
})();
