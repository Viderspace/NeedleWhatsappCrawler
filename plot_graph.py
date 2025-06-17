"""
WhatsApp Group Message Analysis:

This module scans exported WhatsApp JSON files and corresponding CSV analyses,
then produces three different plots:
"""

import os
import glob
import json
import pandas as pd
import matplotlib

import graph_config

matplotlib.use('TkAgg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
from graph_config import group_sizes


def _fix_rtl(s):
    """Reverse Hebrew strings for correct display."""
    return s[::-1] if any('\u0590' <= c <= '\u05FF' for c in s) else s


# Define folders
export_dir = graph_config.export_direction
output_dir = graph_config.output_direction
stats = []


def plot1():
    # Scan each JSON file
    for json_path in glob.glob(os.path.join(export_dir, '*.json')):
        base = os.path.splitext(os.path.basename(json_path))[0]

        expected = os.path.join(output_dir, f'analysij_{base}.csv')
        if not os.path.isfile(expected):
            matches = glob.glob(os.path.join(output_dir, f'analysij_{base}*.csv'))
            if not matches:
                print(f" CSV not found for '{base}', skipping.")
                continue
            expected = matches[0]

        # Load message data
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        messages = data['messages'] if isinstance(data, dict) else data

        total_messages = len(messages)
        total_emojis = sum(
            sum(r.get('count', 0) for r in (msg.get('reactions') or []))
            for msg in messages
        )
        total_with_emojis = total_messages + total_emojis

        # Load CSV analysis
        df = pd.read_csv(expected, encoding='utf-8-sig')
        total_questions = len(df)
        answered_mask = (df['AnswerCount'] + df['ReplyCount'] + df['EmojiCount']) > 0
        num_answered = answered_mask.sum()

        # Calculate percentages
        answered_pct = num_answered / total_with_emojis
        unanswered_pct = (total_questions - num_answered) / total_with_emojis
        other_pct = 1.0 - (answered_pct + unanswered_pct)

        stats.append({
            'group': base,
            'Answered Questions': answered_pct,
            'Unanswered Questions': unanswered_pct,
            'Other Messages': other_pct
        })

    # Create DataFrame
    df = pd.DataFrame(stats)

    # Add participant counts to labels
    df['Participants'] = df['group'].map(group_sizes)
    df['label'] = df['group'] + ' (' + df['Participants'].fillna('?').astype(str) + ')'

    # Sort by participant count (groups with '?' will be at the bottom)
    df = df.sort_values('Participants', ascending=False)

    # Set index to the label with group size
    df = df.set_index('label')
    df = df.drop(columns=['group', 'Participants'])  # Optional cleanup

    # Set colors and labels
    colors = ['green', 'gold', 'lightskyblue']
    he_labels = [_fix_rtl('שאלות שקיבלו תגובה'), _fix_rtl('שאלות שלא קיבלו תגובה'), _fix_rtl('הודעות שאינן שאלות')]

    # Plot the chart
    ax = df.plot(kind='bar', stacked=True, figsize=(15, 10), color=colors)

    # Set Hebrew labels
    ax.set_title(_fix_rtl('פילוח הודעות בקבוצות: שאלות, תגובות, אחרות'))
    ax.set_ylabel(_fix_rtl('אחוזים מכלל ההודעות'))
    ax.set_xlabel(_fix_rtl('קבוצה'))
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(1.0))

    # Legend outside the chart
    plt.legend(
        he_labels,
        title=_fix_rtl('סוג הודעה'),
        loc='upper left',
        bbox_to_anchor=(1.02, 0.98),  # x just outside, y near top
        borderaxespad=0
    )

    # Add percentage labels to each bar segment
    for i, group in enumerate(df.index):
        y_offset = 0
        for j, col in enumerate(df.columns):
            height = df.iloc[i, j]
            if height > 0.0049:
                ax.text(i, y_offset + height / 2, f"{height * 100:.1f}%",
                        ha='center', va='center', fontsize=5, color='black')
            y_offset += height

    # Adjust layout
    plt.xticks(rotation=45, ha='right', fontsize=6)
    plt.tight_layout(rect=[0, 0, 0.85, 1])
    plt.show()


def plot2():
    """
    100% stacked‑bar with Replies (green) at bottom, Emojis (yellow) in middle,
    and Plain Messages (skyblue) on top, with bars ordered by group size,
    legend outside, and counts annotated.
    """
    group_names = []
    plain_msgs  = []
    emojis      = []
    replies     = []

    # collect raw counts per group
    for json_path in glob.glob(os.path.join(export_dir, '*.json')):
        base = os.path.splitext(os.path.basename(json_path))[0]
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        msgs = data.get('messages', []) if isinstance(data, dict) else data

        total       = len(msgs)
        total_repls = sum(1 for m in msgs if m.get('replyTo') is not None)
        total_emj   = sum(
            sum(r.get('count', 0) for r in (m.get('reactions') or []))
            for m in msgs
        )
        total_plain = total - total_repls

        group_names.append(base)
        plain_msgs.append(total_plain)
        emojis.append(total_emj)
        replies.append(total_repls)

    # build DataFrame of raw counts
    df2 = pd.DataFrame({
        'No-Reply/Emoji Messages': plain_msgs,
        'Emojis':         emojis,
        'Replies':        replies
    }, index=group_names)

    # attach participant counts and sort by size descending
    df2['Participants'] = df2.index.map(group_sizes)
    df2 = df2.sort_values('Participants', ascending=False)

    # rename index to include the size
    df2.index = [f"{name} ({size})" for name, size in zip(df2.index, df2['Participants'])]

    # drop the helper column
    df2 = df2.drop(columns='Participants')

    # normalize to proportions
    df_pct = df2.div(df2.sum(axis=1), axis=0).fillna(0)

    # reorder layers: Replies → Emojis → Plain Messages
    df_pct = df_pct[['Replies', 'Emojis', 'No-Reply/Emoji Messages']]

    # plot 100% stacked bar chart
    ax = df_pct.plot(
        kind='bar',
        stacked=True,
        color=['green', 'yellow', 'skyblue'],
        figsize=(18, 9)
    )
    ax.set_title('Group Response Activity by Message and Response Type')
    ax.set_xlabel('WhatsApp Group')
    ax.set_ylabel('Percentage of Total')
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(1.0))
    plt.xticks(rotation=45, ha='right', fontsize=8)

    # annotate each segment with its percentage
    for i, row in enumerate(df_pct.itertuples()):
        y = 0.0
        for val in row[1:]:
            if val >= 0.0005:
                ax.text(
                    i, y + val/2, f"{val*100:.1f}%",
                    ha='center', va='center', fontsize=5, color='black'
                )
            y += val

    # raw counts override for specific groups
    override = {
        'CS 2025': 1032,
    }

    totals_raw = df2.sum(axis=1)
    for i, idx in enumerate(df_pct.index):
        if 'CS 2025' in idx:
            display_total = override['CS 2025']
        else:
            display_total = int(totals_raw[idx])

        ax.text(
            i, 1.005, f"m= {display_total}",
            ha='center', va='bottom', fontsize=6, color='black'
        )

    # move legend outside to the right
    ax.legend(
        df_pct.columns,
        title='Category',
        loc='upper left',
        bbox_to_anchor=(1.02, 0.98),  # x just outside, y near top
        borderaxespad=0
    )

    plt.tight_layout(rect=[0, 0, 0.85, 1])
    plt.show()


def plot3():
    """
    100% stacked-bar chart showing, for each group, the percentage of
    questions that got answered vs. those that did not.
    """
    stats3 = []

    # gather per-group answered/unanswered counts
    for json_path in glob.glob(os.path.join(export_dir, '*.json')):
        base = os.path.splitext(os.path.basename(json_path))[0]

        # find corresponding CSV
        expected = os.path.join(output_dir, f'analysij_{base}.csv')
        if not os.path.isfile(expected):
            matches = glob.glob(os.path.join(output_dir, f'analysij_{base}*.csv'))
            if not matches:
                print(f" CSV not found for '{base}', skipping.")
                continue
            expected = matches[0]

        # load question-level analysis
        df_q = pd.read_csv(expected, encoding='utf-8-sig')
        total_q = len(df_q)
        # answered = any reply, comment or emoji
        is_answered = (df_q['AnswerCount']
                       + df_q['ReplyCount']
                       + df_q['EmojiCount']) > 0
        num_ans = is_answered.sum()
        num_unans = total_q - num_ans

        stats3.append({
            'group': base,
            'Answered': num_ans / total_q if total_q else 0,
            'Unanswered': num_unans / total_q if total_q else 0
        })

    # build DataFrame
    df3 = pd.DataFrame(stats3)
    df3['Participants'] = df3['group'].map(group_sizes)
    df3['label'] = df3['group'] + ' (' + df3['Participants'].fillna('?').astype(str) + ')'
    df3 = df3.sort_values('Participants', ascending=False).set_index('label')

    # only keep percentages
    df3 = df3[['Answered', 'Unanswered']]

    # colors: answered in green, unanswered in gold
    colors = ['green', 'gold']

    ax = df3.plot(
        kind='bar',
        stacked=True,
        figsize=(15, 8),
        color=colors
    )

    # formatting
    ax.set_title(_fix_rtl('שאלות שקיבלו מענה לעומת שלא קיבלו'))
    ax.set_ylabel(_fix_rtl('אחוזים מכלל השאלות'))
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(1.0))
    plt.xticks(rotation=45, ha='right', fontsize=6)

    # annotate each segment
    for i, (ans, unans) in enumerate(zip(df3['Answered'], df3['Unanswered'])):
        if ans > 0.01:
            ax.text(i, ans/2, f"{ans*100:.1f}%", ha='center', va='center', fontsize=5)
        if unans > 0.01:
            ax.text(i, ans + unans/2, f"{unans*100:.1f}%", ha='center', va='center', fontsize=5)

    # legend outside
    plt.legend(
        [_fix_rtl('קיבלו מענה'), _fix_rtl('לא קיבלו מענה')],
        title=_fix_rtl('סטטוס שאלה'),
        loc='upper left',
        bbox_to_anchor=(1.02, 1),
        borderaxespad=0
    )

    plt.tight_layout(rect=[0, 0, 0.85, 1])
    plt.show()



if __name__ == '__main__':
    plot1()
    plot2()
    plot3()
