import type { Page } from "@playwright/test";

/** A style rule as the browser parsed it, flattened out of @media, @layer, @supports and nesting. */
export type ParsedRule = {
  /** The selector chain from the outermost rule to this one, joined with a space. */
  selector: string;
  /** The condition text of every @media / @supports that wraps the rule. */
  conditions: string[];
  /** Every declared property, as `rule.style` exposes it. */
  declarations: Record<string, string>;
  cssText: string;
};

/** Reads every style rule of every same-origin stylesheet from the CSSOM. */
export async function readCssRules(page: Page): Promise<ParsedRule[]> {
  return page.evaluate(() => {
    const rules: ParsedRule[] = [];

    function walk(list: CSSRuleList, selectors: string[], conditions: string[]) {
      for (const rule of Array.from(list)) {
        if (rule instanceof CSSStyleRule) {
          const chain = [...selectors, rule.selectorText];
          const declarations: Record<string, string> = {};
          for (const name of Array.from(rule.style)) {
            declarations[name] = rule.style.getPropertyValue(name).trim();
          }
          rules.push({
            selector: chain.join(" "),
            conditions,
            declarations,
            cssText: rule.cssText,
          });
          if (rule.cssRules.length > 0) walk(rule.cssRules, chain, conditions);
        } else if (rule instanceof CSSConditionRule) {
          walk(rule.cssRules, selectors, [...conditions, rule.conditionText]);
        } else if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) {
          walk(rule.cssRules, selectors, conditions);
        }
      }
    }

    for (const sheet of Array.from(document.styleSheets)) {
      walk(sheet.cssRules, [], []);
    }
    return rules;
  });
}

/**
 * The CSS text the page ships, as served. A browser drops a declaration it does not support from
 * the CSSOM (`-webkit-touch-callout` outside iOS, for one), so a rule meant for iPhone Safari can
 * only be checked here when the emulator is not iPhone Safari.
 */
export async function readShippedCss(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const inline = Array.from(document.querySelectorAll("style")).map((style) => style.textContent);
    const linked = await Promise.all(
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(
        async (link) => (await fetch(link.href)).text(),
      ),
    );
    return [...inline, ...linked].join("\n");
  });
}

/** Whether `cssText` has a rule whose selector list includes `selector` and declares `decl`. */
export function declaresInShippedCss(cssText: string, selector: string, decl: RegExp): boolean {
  const ruleBlock = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of cssText.matchAll(ruleBlock)) {
    const selectors = (match[1] ?? "").split(",").map((part) => part.trim());
    if (selectors.includes(selector) && decl.test(match[2] ?? "")) return true;
  }
  return false;
}
