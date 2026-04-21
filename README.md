# ✦ Xodó Language (`.xo`)

> **"A linguagem que fala a sua língua e pensa com IA."**

O **Xodó** é uma linguagem de programação brasileira, multiparadigma e orientada a agentes, projetada para unir a simplicidade da língua portuguesa com o poder bruto da Inteligência Artificial Generativa.

![Xodó Banner](./public/logo.png)

## ✨ Por que Xodó?

-   **🇧🇷 Sintaxe em Português:** Escreva código como quem conta um caso. `se`, `senao`, `enquanto`, `call`.
-   **🤖 Native AI (ask):** A keyword `ask()` é parte da gramática. Invoque LLMs locais (Ollama/CAFUNE) com Structured Output nativo.
-   **⚡ Async Transparente:** Chamadas de sistema e IA são tratadas de forma eficiente pelo runtime.
-   **📦 Stdlib Tier 7:** Funções nativas de automação de sistema, leitura de arquivos, e notificações.

## 🚀 Exemplo de Código

```xodo
// Definindo um agente de análise
call AnalisarSentimento(texto_usuario) {
    modelo := "llama3"
    sys := "Você é um analista de sentimentos brasileiro."

    // Chamada direta para a IA
    resultado = ask(texto_usuario, modelo, sys, {
        sentimento: texto,
        confianca: numero
    })

    retornar resultado
}

res = AnalisarSentimento("Estou amando codar em Xodó! ✦")
Evoke("Sentimento: {res.sentimento} ({res.confianca * 100}%)")
```

## 🛠️ Instalação

```bash
# Clone o repositório
git clone https://github.com/Rukafuu/Xodo.git

# Instale as dependências
npm install

# Linke o comando global
npm link
```

## 🖥️ CLI
```bash
xodo run meu_script.xo
xodo --debug meu_script.xo  # Inicia em modo debug para o Studio
```

## 📚 Gramática e Features
-   **Declaração:** `:=` para constantes, `=` para mutáveis.
-   **Estruturas:** `se/senao`, `enquanto`, `para_cada`, `tente/pegue`.
-   **Módulos:** `usar "agente_web.xo"`.
-   **Automação:** `executar_comando()`, `area_transferencia()`, `notificar()`.

---

Desenvolvido com 💖 por [Rukafuu](https://github.com/Rukafuu)
