/** analyze_questions.js
* ------------------------------------------------------------
* Scans WhatsApp-style JSON for question messages, uses OpenAI
* to estimate how many of the following messages are answers,
* and writes a CSV report in an output folder, prints details to console,
* counts replies and emoji-reactions on the question itself,
* and names the CSV as analysij_<jsonfilename>.csv in ./output
*
* Usage:
* node analyze_questions.js <messages.json>
*        [--window 30] [--threshold 0.5]
*
* Requirements:
*   npm i openai yargs dotenv
*/

require('dotenv').config();
const fs = require('fs/promises');
const { writeFileSync } = require('fs');
const path = require('path');
const OpenAI = require('openai');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//--------------------------------------------------
// Heuristic: a question if line ends with '?'
//--------------------------------------------------
function isQuestion(text) {
  return text?.trim().endsWith('?') ?? false;
}

//--------------------------------------------------
// Extract relevant info from message
//--------------------------------------------------
function extractMessageInfo(msg) {
  const sender =
    typeof msg.sender === 'string'
      ? msg.sender
      : msg.sender?.pushname || msg.sender?.name || msg.sender?.shortName ||
        msg.sender?.phone || msg.sender?.id || 'Unknown';
  const rawText = msg.body || msg.text || msg.message || '';
  const text = rawText === '[No text]' ? '' : rawText;
  return {
    serialNumber: msg.serialNumber,
    messageId: msg.messageId,
    sender,
    timestamp: msg.datetime || msg.timestamp || '',
    text,
    isReply: Boolean(msg.replyTo) || Boolean(msg.quotedMsg),
    replyTo: msg.replyTo?.ref || null,
    reactions: msg.reactions || []
  };
}

//--------------------------------------------------
// Build LLM prompt
//--------------------------------------------------
function buildPrompt(question, windowMsgs, threshold) {
  const userContent =
    `You are given a *question message* from a group chat and the *next ${windowMsgs.length} messages* that followed it.\n\n` +
    `Question: "${question.text.trim()}"\n\n` +
    `Messages that followed (chronological order):\n` +
    windowMsgs.map((m,i) => `[${i+1}] ${m.sender}: ${m.text}`).join('\n') +
    `\n\nYour task:\n` +
    `Count how many of the above messages are likely (≥ ${Math.round(threshold*100)}% probability) to be *answers to the question* or follow‑up discussion triggered by it.\n` +
    `Only output a single integer — the count.`;
  return [
    {role: 'system', content: 'You are a concise JSON analyst.'},
    {role: 'user', content: userContent}
  ];
}

//--------------------------------------------------
// CSV helper
//--------------------------------------------------
function csvRow(fields) {
  return fields.map(f => `"${String(f ?? '').replace(/"/g,'""')}"`).join(',');
}

//--------------------------------------------------
// Main
//--------------------------------------------------
(async ()=>{
  const argv = yargs(hideBin(process.argv))
    .command('$0 <jsonPath>', 'Analyse WhatsApp JSON', y => {
      y.positional('jsonPath', {describe:'Path to WhatsApp messages JSON', type:'string'});
    })
    .option('window', {alias:'w', type:'number', default:20, describe:'Messages to inspect after each question'})
    .option('threshold', {alias:'t', type:'number', default:0.99, describe:'Probability cutoff (0-1)'})
    .help()
    .argv;

  const {jsonPath, window: win, threshold} = argv;

  // Load JSON
  const raw = await fs.readFile(jsonPath, 'utf-8');
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { console.error(' JSON parse error:', e.message); process.exit(1); }
  const messages = data.messages || data;
  const infos = messages.map(extractMessageInfo);

  // Build reply map (messageId → number of replies)
  const replyMap = {};
  infos.forEach(m => {
    if (m.replyTo) replyMap[m.replyTo] = (replyMap[m.replyTo] || 0) + 1;
  });

  // Identify questions
  const questions = infos.filter(m => isQuestion(m.text) && !m.isReply);
  if (!questions.length) { console.log(' No questions found.'); return; }

  // Ensure output directory
  const outputDir = path.join(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });

  // Determine output filename
  const base = path.basename(jsonPath, path.extname(jsonPath));
  const outFile = path.join(outputDir, `analysij_${base}.csv`);

  // Prepare CSV rows: change first column header from 'Chat' to 'ID'
  const header = ['ID','SerialNumber','TimestampUTC','Sender','QuestionText','ReplyCount','EmojiCount','AnswerCount'];
  const rows = [csvRow(header)];

  for (const q of questions) {
    // Use q.messageId as ID column
    const id = q.messageId;
    const replyCount = replyMap[q.messageId] || 0;
    const emojiCount = q.reactions.reduce((sum, r) => sum + (r.count||0), 0);

    // Prepare window for GPT
    const windowMsgs = infos.slice(q.serialNumber, q.serialNumber + win)
      .filter(m => !m.isReply && m.text);

    // Log details
    console.log(`\n--- Question ${q.serialNumber}: "${q.text.trim()}" by ${q.sender} at ${q.timestamp}`);
    console.log(`Replies: ${replyCount}, Emoji reactions: ${emojiCount}`);

    const prompt = buildPrompt(q, windowMsgs, threshold);
    let answerCount = 0;
    for (let i=0; i<3; i++) {
      try {
        const res = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: prompt, temperature: 0 });
        answerCount = parseInt(res.choices[0].message.content.match(/\d+/)?.[0] || '0', 10);
        break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 500 * 2**i));
      }
    }
    console.log(`GPT found ${answerCount} answers`);

    // Append row: use id instead of base
    rows.push(csvRow([ id, q.serialNumber, q.timestamp, q.sender, q.text.replace(/\s+/g,' ').slice(0,120), replyCount, emojiCount, answerCount ]));
  }

  // Write CSV with UTF-8 BOM so Hebrew preserved
  const bom = '\uFEFF';
  writeFileSync(outFile, bom + rows.join('\n'), 'utf-8');
  console.log(`\n Done. CSV saved to ${outFile}`);
})();
