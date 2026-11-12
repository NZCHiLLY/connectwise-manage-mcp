import { describe, it, expect } from "vitest";
import {
  compactValue,
  stripBoilerplate,
  projectFields,
  shapeToolText,
  normaliseQueryArgs,
} from "../shaping.js";

const DISCLAIMER =
  "This message and its attachments contain confidential information. If you are not the intended recipient, you are strictly prohibited to disclose, copy, distribute or take any action in reliance on the contents of this information. Any views expressed are those of the sender. No liability is accepted for any viruses transmitted by this email.";

describe("compactValue", () => {
  it("drops _info and empty values", () => {
    const input = {
      id: 25,
      notes: "",
      status: { id: 2, name: "Active", _info: { status_href: "x" } },
      customFields: [{ id: 2, value: null }],
    };
    expect(compactValue(input)).toEqual({ id: 25, status: { id: 2, name: "Active" } });
  });

  it("keeps 0, false and \"0\"", () => {
    expect(compactValue({ count: 0, flag: false, s: "0" })).toEqual({
      count: 0,
      flag: false,
      s: "0",
    });
  });
});

describe("stripBoilerplate", () => {
  it("strips the disclaimer and keeps the message", () => {
    const input = `Ran some fixes and asked how it's going\n\n${DISCLAIMER}`;
    expect(stripBoilerplate(input)).toBe("Ran some fixes and asked how it's going");
  });

  it("strips the external sender banner and inline signature images", () => {
    const input =
      "THIS EMAIL IS FROM AN EXTERNAL SENDER. PLEASE BE CAUTIOUS OF ATTACHMENTS AND LINKS.\nHello\n![\\[image\\]](https://aus.myconnectwise.net/v4_6_release/api/inlineimages/tomizone/f873e07f-1)\nBye";
    expect(stripBoilerplate(input)).toBe("Hello\n\nBye");
  });
});

describe("projectFields", () => {
  it("projection tolerates missing paths", () => {
    expect(
      projectFields([{ id: 1, company: { name: "A" } }, { id: 2 }], ["id", "company/name"]),
    ).toEqual([{ id: 1, company: { name: "A" } }, { id: 2 }]);
  });
});

describe("shapeToolText", () => {
  it("wraps arrays with paging", () => {
    const out = shapeToolText('[{"id":1}]', {
      maxTextChars: 2000,
      budget: 40000,
      paging: { hasMore: true, nextPage: 2 },
    });
    expect(JSON.parse(out)).toEqual({
      items: [{ id: 1 }],
      returned: 1,
      hasMore: true,
      nextPage: 2,
      truncated: false,
    });
  });

  it("truncates to budget with a marker", () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ id: i + 1, text: "x".repeat(200) }));
    const out = shapeToolText(JSON.stringify(items), { maxTextChars: 2000, budget: 40000 });
    const parsed = JSON.parse(out);
    expect(parsed.truncated).toBe(true);
    expect(parsed.returned).toBeLessThan(500);
    expect(parsed.items).toHaveLength(parsed.returned);
    expect(out.length).toBeLessThan(40000);
    expect(parsed.hint).toContain("fields=");
    expect(parsed.hint).toContain("page=");
  });

  it("trims an oversize single record", () => {
    const note = { id: 9, text: "y".repeat(254912) };
    const out = shapeToolText(JSON.stringify(note), { maxTextChars: 2000, budget: 40000 });
    expect(out.length).toBeLessThan(40000);
    expect(JSON.parse(out).text.endsWith("[... 252912 more characters]")).toBe(true);
  });

  it("leaves non-JSON text alone", () => {
    const text = "cw_get_ticket failed: boom";
    expect(shapeToolText(text, { maxTextChars: 2000, budget: 40000 })).toBe(text);
  });

  it("projects fields before wrapping", () => {
    const out = shapeToolText('[{"id":1,"summary":"s","company":{"name":"A","id":3}}]', {
      fields: ["id", "company/name"],
      maxTextChars: 2000,
      budget: 40000,
    });
    expect(JSON.parse(out).items).toEqual([{ id: 1, company: { name: "A" } }]);
  });
});

describe("normaliseQueryArgs", () => {
  it("decodes HTML entities", () => {
    expect(
      normaliseQueryArgs("cw_search_tickets", { conditions: "id &gt; 5 and id &lt;= 9 &amp;&amp; x" }),
    ).toEqual({ conditions: "id > 5 and id <= 9 && x" });
  });

  it("aliases note dates", () => {
    expect(
      normaliseQueryArgs("cw_get_ticket_notes", {
        orderBy: "dateCreated desc",
        conditions: "dateCreated > [2026-11-01T00:00:00Z]",
      }),
    ).toEqual({
      orderBy: "_info/dateEntered desc",
      conditions: "_info/dateEntered > [2026-11-01T00:00:00Z]",
    });
  });

  it("does not double-prefix _info/dateEntered", () => {
    expect(
      normaliseQueryArgs("cw_get_ticket_notes", { orderBy: "_info/dateEntered desc" }),
    ).toEqual({ orderBy: "_info/dateEntered desc" });
    expect(
      normaliseQueryArgs("cw_get_ticket_notes", { orderBy: "dateEntered desc" }),
    ).toEqual({ orderBy: "_info/dateEntered desc" });
  });

  it("aliases opportunity closedFlag", () => {
    expect(
      normaliseQueryArgs("cw_search_opportunities", { conditions: "closedFlag = false" }),
    ).toEqual({ conditions: "closedDate = null" });
    expect(
      normaliseQueryArgs("cw_search_opportunities", { conditions: "closedFlag=true" }),
    ).toEqual({ conditions: "closedDate != null" });
  });

  it("leaves other tools alone", () => {
    expect(
      normaliseQueryArgs("cw_search_tickets", { conditions: "closedFlag = false" }),
    ).toEqual({ conditions: "closedFlag = false" });
  });

  it("does not touch values inside quoted strings", () => {
    expect(
      normaliseQueryArgs("cw_get_ticket_notes", { conditions: 'summary contains "dateCreated"' }),
    ).toEqual({ conditions: 'summary contains "dateCreated"' });
  });

  it("touches only the four query arguments", () => {
    expect(
      normaliseQueryArgs("cw_get_ticket_notes", { text: "dateCreated &amp;", pageSize: 5 }),
    ).toEqual({ text: "dateCreated &amp;", pageSize: 5 });
  });
});
