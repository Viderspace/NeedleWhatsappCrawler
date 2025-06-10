import os
import sys
import glob
import json
import pandas as pd
import matplotlib
import config_group_stats_grapher
import matplotlib.pyplot as plt
matplotlib.use('TkAgg')


__all__ = ['GroupStatsGrapher']


def _fix_rtl(s):
    return s[::-1] if any('\u0590' <= c <= '\u05FF' for c in s) else s


class GroupStatsGrapher:
    """
        GroupStatsGrapher is a class for analyzing and visualizing WhatsApp group chat statistics.

        It loads JSON data containing messages and emoji reactions per group,
        categorizes emojis into predefined emotional categories, and provides
        four public methods to generate visual bar charts:

        - plot_messages_graph(): Messages and replies per group
        - plot_emojis_graph(): Emoji reactions per group by category
        - plot_combined_graph(): Side-by-side messages, replies, and emojis
        - plot_message_and_emoji_total_graph(): Total messages including emoji and reply proportions

        """

    def __init__(self, data_d):
        if not data_dir:
            print("Usage:\n    python plot_group_emojis.py <input_json_dir>")

        self._emoji_categories = config_group_stats_grapher.EMOJI_CATEGORIES
        self._colors = config_group_stats_grapher.COLORS
        self._group_participants = config_group_stats_grapher.GROUP_PARTICIPANTS

        self._df = self._load_stats(data_d)

    # ======================= PUBLIC FUNCS ========================

    def plot_messages_graph(self):
        """Plot a bar chart of total messages and replies per group."""
        self._plot_messages_graph(self._df.copy())

    def plot_emojis_graph(self):
        """Plot a stacked bar chart of emoji reactions by category per group."""
        self._plot_emojis_graph(self._df.copy())

    def plot_combined_graph(self):
        """Plot side-by-side bars of messages, replies, and categorized emojis per group."""
        self._plot_combined_graph(self._df.copy())

    def plot_message_and_emoji_total_graph(self):
        """Plot total messages including emojis, with proportions of replies and emoji reactions."""
        self._plot_message_and_emoji_total_graph(self._df.copy())

    # ======================= HELPERS ====================================

    def _categorize_emoji(self, emoji):
        for category, emojis in self._emoji_categories.items():
            if emoji in emojis:
                return category
        return 'other'

    def _create_xtick_labels(self, df):
        return [f"{_fix_rtl(group)}\n({self._group_participants.get(group, '?')} members)" for group in df.index]

    def _load_stats(self, data_d):
        stats = []
        for path in glob.glob(os.path.join(data_d, '*.json')):
            group_name = os.path.splitext(os.path.basename(path))[0]
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as e:
                print(f"Skipping {group_name}: {e}")
                continue

            msgs = data.get('messages', [])
            replies = sum(1 for m in msgs if isinstance(m.get('replyTo'), dict))

            emoji_counts = {cat: 0 for cat in self._emoji_categories}
            emoji_counts['other'] = 0

            for m in msgs:
                reactions = m.get('reactions')
                if isinstance(reactions, list):
                    for reaction in reactions:
                        emoji = reaction.get('emoji')
                        count = reaction.get('count', 1)
                        category = self._categorize_emoji(emoji)
                        emoji_counts[category] += count

            stats.append({
                'Group': group_name,
                'Messages': len(msgs),
                'Replies': replies,
                **emoji_counts
            })

        return pd.DataFrame(stats)

    def _plot_messages_graph(self, df):
        df.set_index('Group', inplace=True)
        x = range(len(df))
        fig, ax = plt.subplots(figsize=(14, 6))
        ax.bar(x, df['Messages'], color=self._colors['messages'], label='Messages')
        ax.bar(x, df['Replies'], color=self._colors['replies'], label='Replies')

        for i, group in enumerate(df.index):
            total, replies = df.loc[group, 'Messages'], df.loc[group, 'Replies']
            percent = (replies / total * 100) if total > 0 else 0
            ax.text(i, total + 5, f"{percent:.0f}%", ha='center', fontsize=9)

        ax.set_xticks(x)
        ax.set_xticklabels(self._create_xtick_labels(df), rotation=45, ha='right')
        ax.set_ylabel('Count')
        ax.set_title('Messages and Replies per Group')
        ax.legend()
        plt.tight_layout()
        plt.show()

    def _plot_emojis_graph(self, df):
        emoji_cats = list(self._emoji_categories.keys()) + ['other']
        df.set_index('Group', inplace=True)
        x = range(len(df))
        fig, ax = plt.subplots(figsize=(14, 6))
        bottom = [0] * len(df)

        for cat in emoji_cats:
            values = df[cat]
            label = 'Other Emojis' if cat == 'other' else cat.capitalize()
            ax.bar(x, values, bottom=bottom, color=self._colors[cat], label=label)
            bottom = [b + v for b, v in zip(bottom, values)]

        for i in range(len(df)):
            total = sum(df.iloc[i][cat] for cat in emoji_cats)
            ax.text(i, total + 5, str(total), ha='center', fontsize=9)

        ax.set_xticks(x)
        ax.set_xticklabels(self._create_xtick_labels(df), rotation=45, ha='right')
        ax.set_ylabel('Count')
        ax.set_title('Emoji Reactions per Group')
        ax.legend(loc='upper left', bbox_to_anchor=(1.01, 1.02), ncol=2, fontsize=10)
        plt.tight_layout()
        plt.show()

    def _plot_combined_graph(self, df):
        emoji_cats = list(self._emoji_categories.keys()) + ['other']
        df.set_index('Group', inplace=True)
        x = range(len(df))
        fig, ax = plt.subplots(figsize=(16, 8))
        bar_width_left = 0.35
        bar_width_right = 0.25

        ax.bar([i - bar_width_left for i in x], df['Messages'], width=bar_width_left,
               color=self._colors['messages'], label='Messages')
        ax.bar([i - bar_width_left for i in x], df['Replies'], width=bar_width_left,
               color=self._colors['replies'], label='Replies')

        for i, group in enumerate(df.index):
            total, replies = df.loc[group, 'Messages'], df.loc[group, 'Replies']
            percent = (replies / total * 100) if total > 0 else 0
            ax.text(i - bar_width_left, total + 5, f"{percent:.0f}%", ha='center', fontsize=9)

        bottom = [0] * len(df)
        for cat in emoji_cats:
            values = df[cat]
            label = 'Other Emojis' if cat == 'other' else cat.capitalize()
            ax.bar([i + bar_width_right for i in x], values, bottom=bottom,
                   width=bar_width_right, color=self._colors[cat], label=label)
            bottom = [b + v for b, v in zip(bottom, values)]

        for i in range(len(df)):
            total = sum(df.iloc[i][cat] for cat in emoji_cats)
            ax.text(i + bar_width_right, total + 5, str(total), ha='center', fontsize=9)

        ax.set_xticks(x)
        ax.set_xticklabels(self._create_xtick_labels(df), rotation=45, ha='right')
        ax.set_ylabel('Count')
        ax.set_title('Messages, Replies, and Emoji Reactions per Group')
        ax.legend(loc='upper left', bbox_to_anchor=(1.01, 1.02), ncol=2, fontsize=10)
        plt.tight_layout()
        plt.show()

    def _plot_message_and_emoji_total_graph(self, df):
        df.set_index('Group', inplace=True)
        x = range(len(df))
        total_emoji = df[list(self._emoji_categories.keys()) + ['other']].sum(axis=1)
        total_combined = df['Messages'] + total_emoji
        total_replies = df['Replies']

        bar_width = 0.3
        fig, ax = plt.subplots(figsize=(14, 6))

        ax.bar(x, total_combined, width=bar_width, color=self._colors['emoji_and_messages'], label='Messages + Emojis')
        ax.bar(x, total_emoji, width=bar_width, color=self._colors['emoji_in_emoji_and_messages'], label='Emojis')
        ax.bar(x, total_replies, width=bar_width, color=self._colors['replies_in_emoji_and_messages'], label='Replies')

        for i in range(len(df)):
            total = total_combined.iloc[i]
            emoji_count = total_emoji.iloc[i]
            reply_count = total_replies.iloc[i]
            emoji_pct = (emoji_count / total) * 100 if total else 0
            reply_pct = (reply_count / total) * 100 if total else 0
            ax.text(i, total + 5, f"{emoji_pct:.0f}% emojis\n{reply_pct:.0f}% replies", ha='center',
                    va='bottom', fontsize=8)

        ax.set_xticks(x)
        ax.set_xticklabels(self._create_xtick_labels(df), rotation=45, ha='right')
        ax.set_ylabel('Count')
        ax.set_title('Total Messages Including Emoji Reactions per Group')
        ax.legend()
        plt.tight_layout()
        plt.show()


# Example usage
if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage:\n    python plot_group_emojis.py <input_json_dir>")
        sys.exit(1)
    data_dir = sys.argv[1]

    grapher = GroupStatsGrapher(data_dir)

    # Call any of the public plotting functions
    grapher.plot_messages_graph()
    grapher.plot_emojis_graph()
    grapher.plot_combined_graph()
    grapher.plot_message_and_emoji_total_graph()
