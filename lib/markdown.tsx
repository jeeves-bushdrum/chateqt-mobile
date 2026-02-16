import React from "react";
import { Text, StyleSheet, Linking } from "react-native";

const colors = {
  text: "#e2e8f0",
  link: "#60a5fa",
  code: "#94a3b8",
  codeBg: "rgba(148,163,184,0.1)",
  bold: "#f1f5f9",
};

interface Props {
  children: string;
  style?: any;
}

/**
 * Lightweight markdown renderer for React Native.
 * Supports: **bold**, [links](url), `inline code`, bullet lists (- item).
 */
export function Markdown({ children, style }: Props) {
  const lines = children.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet list items
    if (/^[\-\*•]\s/.test(line.trim())) {
      elements.push(
        <Text key={i} style={[styles.text, style]}>
          {"  • "}
          {parseInline(line.trim().slice(2))}
          {"\n"}
        </Text>
      );
      continue;
    }

    // Numbered list items
    if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+\.)\s(.*)/);
      if (match) {
        elements.push(
          <Text key={i} style={[styles.text, style]}>
            {"  "}{match[1]}{" "}{parseInline(match[2])}
            {"\n"}
          </Text>
        );
        continue;
      }
    }

    // Regular line
    elements.push(
      <Text key={i} style={[styles.text, style]}>
        {parseInline(line)}
        {i < lines.length - 1 ? "\n" : ""}
      </Text>
    );
  }

  return <Text>{elements}</Text>;
}

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match **bold**, [link](url), `code`
  const pattern = /(\*\*(.+?)\*\*)|(\[([^\]]+)\]\(([^)]+)\))|(`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold**
      nodes.push(
        <Text key={key++} style={styles.bold}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // [link](url)
      const url = match[5];
      nodes.push(
        <Text
          key={key++}
          style={styles.link}
          onPress={() => Linking.openURL(url)}
        >
          {match[4]}
        </Text>
      );
    } else if (match[6]) {
      // `code`
      nodes.push(
        <Text key={key++} style={styles.code}>
          {match[7]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

const styles = StyleSheet.create({
  text: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: "700",
    color: colors.bold,
  },
  link: {
    color: colors.link,
    textDecorationLine: "underline",
  },
  code: {
    fontFamily: "monospace",
    color: colors.code,
    backgroundColor: colors.codeBg,
    borderRadius: 3,
    paddingHorizontal: 4,
    fontSize: 13,
  },
});
