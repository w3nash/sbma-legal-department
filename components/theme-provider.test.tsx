import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "./theme-provider";

describe("ThemeProvider", () => {
  it("does not render inline script tags from the provider tree", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <div>App</div>
      </ThemeProvider>
    );

    expect(html).not.toContain("<script");
    expect(html).toContain("App");
  });
});
