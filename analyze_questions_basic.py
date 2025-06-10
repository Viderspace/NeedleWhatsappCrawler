import os
import sys
import glob
import json
import re
import pandas as pd

def sanitize_filename(name):
    """
    Replace characters not allowed in Windows file names with underscore.
    """
    return re.sub(r'[\\/:*?"<>|]', '_', name)


def analyze_chat(messages, chat_name):
    """
    Analyze a single chat's messages to extract questions and
    count replies and reaction emojis for each question.

    Args:
        messages (list of dict): List of message objects from a chat export.
        chat_name (str): Name identifier for the chat.

    Returns:
        pandas.DataFrame: DataFrame with columns:
            - Chat: chat name
            - SerialNumber: message sequence number
            - TimestampUTC: original UTC timestamp string
            - LocalTime: converted local timestamp (Asia/Jerusalem)
            - Sender: sender display name
            - QuestionText: full text of the question message
            - ReplyCount: count of direct replies to this message
            - ReactionCount: count of emoji reactions on this message
    """
    records = []
    for msg in messages:
        text = msg.get('body') or ''
        if '?' not in text:
            continue

        qid = msg.get('messageId')

        # Count direct replies by matching 'ref' in replyTo
        direct_replies = [
            m for m in messages
            if isinstance(m.get('replyTo'), dict) and m['replyTo'].get('ref') == qid
        ]
        num_replies = len(direct_replies)

        # Sum up all reaction emoji counts
        reactions = msg.get('reactions') or []
        num_reactions = sum(r.get('count', 0) for r in reactions)

        records.append({
            'Chat':          chat_name,
            'SerialNumber':  msg.get('serialNumber'),
            'TimestampUTC':  msg.get('datetime'),
            'Sender':        msg.get('SenderName'),
            'QuestionText':  text,
            'ReplyCount':    num_replies,
            'ReactionCount': num_reactions
        })

    df = pd.DataFrame(records)
    if not df.empty:
        # Parse UTC timestamp, convert to local time
        df['TimestampUTC'] = pd.to_datetime(df['TimestampUTC'], utc=True)
        df['LocalTime'] = (
            df['TimestampUTC']
            .dt.tz_convert('Asia/Jerusalem')
            .dt.strftime('%Y-%m-%d %H:%M:%S')
        )
        df['TimestampUTC'] = df['TimestampUTC'].dt.strftime('%Y-%m-%d %H:%M:%S')
        df = df[
            [
                'Chat', 'SerialNumber', 'TimestampUTC', 'LocalTime',
                'Sender', 'QuestionText', 'ReplyCount', 'ReactionCount'
            ]
        ]
    return df


def main(input_dir, output_dir):
    """
    Process all JSON chat exports in the input directory,
    generate per-chat CSVs of question records and a combined CSV.

    Args:
        input_dir (str): Path to directory containing JSON exports.
        output_dir (str): Path where CSV files will be saved.
    """
    os.makedirs(output_dir, exist_ok=True)
    all_dfs = []

    for path in glob.glob(os.path.join(input_dir, '*.json')):
        raw_name = os.path.splitext(os.path.basename(path))[0]
        safe_name = sanitize_filename(raw_name)

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        messages = data.get('messages', [])
        df = analyze_chat(messages, raw_name)

        if not df.empty:
            out_csv = os.path.join(output_dir, f'{safe_name}_questions.csv')
            try:
                df.to_csv(out_csv, index=False, encoding='utf-8-sig')
                print(f'→ Wrote {len(df)} questions for "{raw_name}" to {out_csv}')
            except PermissionError:
                print(f'⚠️ Permission denied, skipped writing file: {out_csv}')
        all_dfs.append(df)

    # Combine and write all chats
    if any(len(df) > 0 for df in all_dfs):
        combined = pd.concat(all_dfs, ignore_index=True)
        combined_path = os.path.join(output_dir, 'all_chats_questions.csv')
        try:
            combined.to_csv(combined_path, index=False, encoding='utf-8-sig')
            print(f'→ Wrote combined table with {len(combined)} rows to {combined_path}')
        except PermissionError:
            print(f'⚠️ Permission denied, skipped writing combined file: {combined_path}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python analyze_all_questions.py <input_json_dir> <output_csv_dir>")
        sys.exit(1)

    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    main(input_dir, output_dir)
