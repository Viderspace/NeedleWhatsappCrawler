# 🧵 NeedleWhatsappCrawler

A collaborative Node.js project for extracting and enriching messages from WhatsApp groups using [`@open-wa/wa-automate`](https://github.com/open-wa/wa-automate-nodejs).

This tool is designed for structured WhatsApp data collection and analysis within our academic course project (מחט בערימת דאטה - 67978).

> Project by Jonatan Vider, Yonatan Ezra, and Netanel Richey

---

## 🚀 What It Does

- 🔐 Authenticates with WhatsApp Web (via QR scan)
- 🧠 Crawls full message history from a selected WhatsApp group
- 🧩 Enriches messages with:
  - Author identity (name/phone/LID)
  - Reactions
  - Reply references
- 💾 Saves output to a structured `.json` file

---

## 🛠️ Setup Instructions (for team use)

### 1. Clone the repo

```bash
git clone https://github.com/Viderspace/NeedleWhatsappCrawler.git
cd NeedleWhatsappCrawler
```

### 2. Install dependencies

Ensure you're using **Node.js v18+**:

```bash
npm install
```

### 3. Define your target WhatsApp group

Edit `config.js` and change the `TARGET_GROUP_NAME` value:

```js
// config.js
const TARGET_GROUP_NAME = 'Group Chat Name Here';
```

Each team member should set the group name *on their own machine* before running.

---

## 🧪 How to Run

```bash
node crawl.js
```

On first run:
- A browser window will open to WhatsApp Web
- Scan the QR code with your phone
- The script will:
  - Locate the group
  - Crawl up to 5000 recent messages
  - Enrich the data
  - Save the output JSON file

---

## 📁 Output

Files will be saved in the shared `exports/` directory.

| File | Description |
|------|-------------|
| `exports/<group>.json` | Main export: messages + participant data |
| `filtered_debug_participants.json` | Optional debug info (filtered participant list) |
| `filtered_debug_messages.json` | Optional debug info (message header, phone, LID) |

Each team member should run the script independently and contribute their own `.json` file to the shared `exports/` folder for group analysis.

---

## 🧼 Troubleshooting

If the script hangs on login or fails to scrape:
- Quit the script and rerun
- Close any WhatsApp browser tabs that may have been left open
- Delete any cached folders (e.g. `.wwebjs_auth`, `.wwebjs_cache`) if problems persist

⚠️ Sometimes the **authentication process gets stuck** — in that case, simply stop and rerun the script.

---

## 📜 License

MIT License – see [`LICENSE`](./LICENSE) for full terms.

