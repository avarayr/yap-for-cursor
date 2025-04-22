# <p align="center"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Speaking%20Head.webp" alt="Speaking Head" width="128" height="128" /><br/> Yap For Cursor </p>

🗣️ Local, WebGPU-powered voice-to-text capabilities directly into the Cursor editor using the power of Hugging Face Transformers.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/avarayr)

https://github.com/user-attachments/assets/ea641fb8-00c8-4da8-b0b8-b6e11aac6478

## ✨ Features

- 🎙️ **LOCAL VOICE TRANSCRIPTION:** Transcribe your speech directly into the Cursor chat input using the power of Hugging Face Transformers (Whisper model).
- 🔒 **IN-BROWSER PROCESSING:** All transcription happens _locally_ in your editor. No data sent to external servers (besides downloading the model initially).
- 🖱️ **SEAMLESS INTEGRATION:** Adds a microphone button directly to the Cursor UI.

## 🚀 Installation Guide

This project injects custom JavaScript into Cursor via the `Custom CSS and JS Loader` extension.

1.  **Clone the Repository <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/File%20Folder.png" alt="File Folder" width="20" height="20" />**

    ```bash
    git clone https://github.com/avarayr/yap-for-cursor.git
    ```

2.  **Install [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css) Extension**

    You need to install the [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css) Extension.

3.  **Cursor > Open User Settings (JSON) <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Gear.png" alt="Gear" width="20" height="20" />**

    - Open your User Settings (Command Palette: `Preferences: Open User Settings (JSON)`).

    - Add the following:

    **Important:** Use the `file:///` prefix and **forward slashes `/`** for the path, even on Windows.

    ```json
    "vscode_custom_css.imports": [
      "file:///path/to/your/clone/of/yap-for-cursor/dist/yap-for-cursor.js"
    ],
    ```

    <details>
      <summary>Click for Path Examples</summary>

    - _macOS/Linux Example:_ `"file:///Users/yourname/yap-for-cursor/dist/yap-for-cursor.js"`
    - _Windows Example:_ `"file:\\C:\\Users\\yourname\\yap-for-cursor\\dist\\yap-for-cursor.js"`
    </details>
    <br/>

4.  **Enable Custom Code <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Symbols/Check%20Mark%20Button.png" alt="Check Mark Button" width="20" height="20" />**

    Open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) and run:

    ```
    Enable Custom CSS and JS
    ```

5.  **Restart Cursor**

    Close and fully reopen Cursor to apply the changes.

## **🚨 Important:** You **MUST** re-run the `Enable Custom CSS and JS` command after EVERY Cursor update.

## 🛠️ How to Use

1.  🖱️ Click the **microphone icon** that appears near the chat input.
2.  ⏳ The first time (or after clearing cache), the ASR model needs to download. Please wait a moment.
3.  🔴 Once ready, click the icon again to **start recording**.
4.  🗣️ Speak clearly.
5.  ⏹️ Click the icon again to **stop recording**.
6.  ⌨️ Your transcribed text will appear in the chat input box!

## 🖥️ Compatibility

- ✅ Cursor version: 0.49.0+

- ✅ **macOS**: (Apple Silicon & Intel) with WebGPU support.
- ⚠️ **Windows/Linux:** Might work, but **requires WebGPU support** in the underlying browser/Electron version used by Cursor. Functionality isn't guaranteed. _Testing and feedback welcome!_

---

## Hotkeys:

- `Cmd+Shift+Y` to toggle the transcription.

(work in progress)

---

[![Star History Chart](https://api.star-history.com/svg?repos=avarayr/yap-for-cursor&type=Date)](https://www.star-history.com/#avarayr/yap-for-cursor&Date)

---

## ❤️ Support The Project

If you find `yap-for-cursor` helpful, consider supporting the developer!

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/avarayr)
