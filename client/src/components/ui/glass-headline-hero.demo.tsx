"use client";

import GlassHeadlineHero from "@/components/ui/glass-headline-hero";

/**
 * The component's own demo, exactly as it was written: the default palette
 * and the default full-screen height.
 *
 * The Home screen uses the same component in its compact, brand-coloured
 * form. This page is here so the effect can be judged at the size it was
 * designed for. It is not in the navigation - it is a component demo, not
 * somewhere a person using VoicePay needs to go.
 */
export default function Demo() {
  return (
    <GlassHeadlineHero
      eyebrow="Lumen 2.0 is here"
      title="Bend the light"
      description="Interfaces that feel crafted, not assembled. Lumen turns your design tokens into production UI in an afternoon."
      primaryAction={{ label: "Start for free", href: "#" }}
      secondaryAction={{ label: "Watch the film", href: "#" }}
    />
  );
}
