import { createFileRoute } from "@tanstack/react-router";
import { StoryShowcase } from "@/components/verihk/StoryShowcase";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "VeriHK — Official Hong Kong Data Verification" },
      {
        name: "description",
        content:
          "A premium AI verification experience that turns public information into source-cited evidence from official Hong Kong data.",
      },
      { property: "og:title", content: "VeriHK — Official Hong Kong Data Verification" },
      {
        property: "og:description",
        content: "Verify information with official Hong Kong data.",
      },
    ],
  }),
  component: StoryShowcase,
});
