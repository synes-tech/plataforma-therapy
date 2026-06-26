import { StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_COLORS, PDF_FONTS } from './pdf-design-system';
import type { PdfTextBlock } from './pdf-types';

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

const styles = StyleSheet.create({
  h1: {
    fontFamily: PDF_FONTS.display,
    fontSize: 14,
    color: PDF_COLORS.charcoal,
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontFamily: PDF_FONTS.bodyBold,
    fontSize: 11,
    color: PDF_COLORS.primaryDark,
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  h3: {
    fontFamily: PDF_FONTS.bodyBold,
    fontSize: 10.5,
    color: PDF_COLORS.charcoal,
    marginTop: 10,
    marginBottom: 5,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.55,
    color: PDF_COLORS.charcoalMuted,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 5,
    paddingRight: 8,
  },
  bulletDot: {
    width: 14,
    fontSize: 10,
    color: PDF_COLORS.primary,
    lineHeight: 1.55,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.55,
    color: PDF_COLORS.charcoalMuted,
  },
  orderedIndex: {
    width: 18,
    fontSize: 10,
    color: PDF_COLORS.primaryDark,
    lineHeight: 1.55,
    fontFamily: PDF_FONTS.bodyBold,
  },
  inlineBold: {
    fontFamily: PDF_FONTS.bodyBold,
    color: PDF_COLORS.charcoal,
  },
  inlineEm: {
    fontStyle: 'italic',
    color: PDF_COLORS.charcoalMuted,
  },
  inlineCode: {
    fontFamily: PDF_FONTS.mono,
    fontSize: 9,
    color: PDF_COLORS.primaryDark,
    backgroundColor: PDF_COLORS.surface,
  },
});

function PdfInlineText({ text, style }: { text: string; style: (typeof styles)[keyof typeof styles] }) {
  const parts = text.split(INLINE_PATTERN).filter((part) => part.length > 0);

  if (parts.length <= 1) {
    return <Text style={style}>{text}</Text>;
  }

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={index} style={[style, styles.inlineBold]}>
              {part.slice(2, -2)}
            </Text>
          );
        }

        if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
          return (
            <Text key={index} style={[style, styles.inlineEm]}>
              {part.slice(1, -1)}
            </Text>
          );
        }

        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <Text key={index} style={[style, styles.inlineCode]}>
              {part.slice(1, -1)}
            </Text>
          );
        }

        return part;
      })}
    </Text>
  );
}

export function PdfContentBlocks({ blocks }: { blocks: PdfTextBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'h1') {
          return (
            <View key={index} wrap={false}>
              <PdfInlineText text={block.text} style={styles.h1} />
            </View>
          );
        }

        if (block.type === 'h2') {
          return (
            <View key={index} wrap={false}>
              <PdfInlineText text={block.text} style={styles.h2} />
            </View>
          );
        }

        if (block.type === 'h3') {
          return (
            <View key={index} wrap={false}>
              <PdfInlineText text={block.text} style={styles.h3} />
            </View>
          );
        }

        if (block.type === 'ul') {
          return (
            <View key={index}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <PdfInlineText text={item} style={styles.bulletText} />
                </View>
              ))}
            </View>
          );
        }

        if (block.type === 'ol') {
          return (
            <View key={index}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.bulletRow}>
                  <Text style={styles.orderedIndex}>{itemIndex + 1}.</Text>
                  <PdfInlineText text={item} style={styles.bulletText} />
                </View>
              ))}
            </View>
          );
        }

        return <PdfInlineText key={index} text={block.text} style={styles.paragraph} />;
      })}
    </>
  );
}
