import React from "react";
import { Box, Text, useStdout } from "ink";
import { marieTheme } from "../styles/theme.js";

interface BannerProps {
  show?: boolean;
}

export const Banner: React.FC<BannerProps> = ({ show = true }) => {
  const { stdout } = useStdout();
  const width = stdout?.columns || 80;

  if (!show) return null;

  // If screen is too small, use compact banner
  if (width < 65) {
    return <CompactBanner />;
  }

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      marginTop={0}
      marginBottom={0}
    >
      {/* Claude Code inspired artistic banner */}
      <Box flexDirection="column" alignItems="center">
        <Text color={marieTheme.colors.primary}>
          {"    ╭──────────────────────────────────────────────╮"}
        </Text>
        <Text color={marieTheme.colors.primary}>
          {"    │   ███╗   ███╗ █████╗ ██████╗ ██╗███████╗   │"}
        </Text>
        <Text color={marieTheme.colors.primary}>
          {"    │   ████╗ ████║██╔══██╗██╔══██╗██║██╔════╝   │"}
        </Text>
        <Text color={marieTheme.colors.primary}>
          {"    │   ██╔████╔██║███████║██████╔╝██║█████╗     │"}
        </Text>
        <Text color={marieTheme.colors.primary}>
          {"    │   ██║╚██╔╝██║██╔══██║██╔══██╗██║██╔══╝     │"}
        </Text>
        <Text color={marieTheme.colors.primary}>
          {"    │   ██║ ╚═╝ ██║██║  ██║██║  ██║██║███████╗   │"}
        </Text>
        <Text color={marieTheme.colors.primary}>
          {"    │   ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝   │"}
        </Text>
        <Text color={marieTheme.colors.primary}>
          {"    │                                              │"}
        </Text>
        <Text color={marieTheme.colors.secondary}>
          {"    │      ✦  AI Coding Assistant  ✦              │"}
        </Text>
        <Text color={marieTheme.colors.muted}>
          {"    │         v0.2.0 · Ready to help              │"}
        </Text>
        <Text color={marieTheme.colors.primary}>
          {"    ╰──────────────────────────────────────────────╯"}
        </Text>
      </Box>
    </Box>
  );
};

// Alternative compact banner for smaller screens
export const CompactBanner: React.FC = () => {
  return (
    <Box flexDirection="column" alignItems="center" marginY={0}>
      <Text color={marieTheme.colors.primary} bold>
        {"╔══════════════════════════════════════════╗"}
      </Text>
      <Text color={marieTheme.colors.primary} bold>
        {"║  🌸  Marie  ·  AI Coding Assistant  🌸  ║"}
      </Text>
      <Text color={marieTheme.colors.primary} bold>
        {"╚══════════════════════════════════════════╝"}
      </Text>
    </Box>
  );
};

// Welcome banner with tips
export const WelcomeBanner: React.FC = () => {
  return (
    <Box flexDirection="column" alignItems="center" marginTop={0} marginBottom={1}>
      <Banner />
      <Box flexDirection="column" alignItems="center" marginTop={0}>
        <Text color={marieTheme.colors.secondary}>
          {"  Welcome! Type your message to start coding with AI."}
        </Text>
        <Text color={marieTheme.colors.muted} dimColor>
          {"  Tip: Use /help for commands, /config to change settings"}
        </Text>
      </Box>
    </Box>
  );
};
