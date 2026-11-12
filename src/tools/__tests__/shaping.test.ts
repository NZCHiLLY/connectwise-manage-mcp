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

// The full Tomizone disclaimer, copied from scripts/make-oversize-notes-fixture.mjs.
const FULL_DISCLAIMER =
  "This message and its attachments contain confidential information. If you are not the intended recipient, you are strictly prohibited to disclose, copy, distribute or take any action in reliance on the contents of this information. E-mail transmission cannot be guaranteed to be secure or error-free, as information could be intercepted, corrupted, lost, destroyed, arrive late or incomplete, or contain viruses. The sender therefore does not accept liability for any errors or omissions in the contents of this message, which arise as a result of e-mail transmission. If verification is required please request a hard-copy version. Tomizone accepts no liability for the content of this email, or for the consequences of any actions taken on the basis of the information provided, unless that information is subsequently confirmed in writing. Any views or opinions presented in this email are solely those of the author and do not necessarily represent those of Tomizone. WARNING: Computer viruses can be transmitted via email. The recipient should check this email and any attachments for the presence of viruses. Tomizone accepts no liability for any damage caused by any virus transmitted by this email.";

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

  it("keeps _info scalar dates and drops its links", () => {
    expect(
      compactValue({ _info: { dateEntered: "2026-11-01T00:00:00Z", company_href: "x" } }),
    ).toEqual({ _info: { dateEntered: "2026-11-01T00:00:00Z" } });
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

  it("strips the real full disclaimer and keeps the text before it", () => {
    const before = "Restarted the print spooler and the queue is clear.\n\nRegards,\nSupport Analyst";
    const out = stripBoilerplate(`${before}\n\n${FULL_DISCLAIMER}`);
    expect(out).toBe(before);
    expect(out).not.toContain("confidential information");
    expect(out).not.toContain("transmitted by this email");
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
    expect(parsed.pageTotal).toBe(500);
    expect(parsed.omitted).toBe(500 - parsed.returned);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.hint).toBe(
      `${parsed.omitted} of 500 rows on this page were omitted to fit the size limit and are NOT on nextPage. Request the same page and pageSize again with fewer fields= to see them, or restart at page 1 with pageSize=${parsed.returned} and page forward.`,
    );
  });

  it("keeps one oversize row rather than returning none", () => {
    const out = shapeToolText(JSON.stringify([{ id: 1, name: "z".repeat(5000) }]), {
      maxTextChars: 2000,
      budget: 1000,
    });
    const parsed = JSON.parse(out);
    expect(parsed.returned).toBe(1);
    expect(parsed.items).toHaveLength(1);
  });

  it("keeps real content between a closeless disclaimer and a full one", () => {
    const open =
      "This message and its attachments contain confidential information. If you are not the intended recipient";
    const out = stripBoilerplate(`Reply A\n${open}\nREAL CONTENT\n${DISCLAIMER}`);
    expect(out).toContain("REAL CONTENT");
    expect(out).toContain("Reply A");
  });

  it("trims an oversize single record", () => {
    const note = { id: 9, text: "y".repeat(254912) };
    const out = shapeToolText(JSON.stringify(note), { maxTextChars: 2000, budget: 40000 });
    expect(out.length).toBeLessThan(40000);
    expect(JSON.parse(out).text.endsWith("[display cut: 252912 more characters stored]")).toBe(true);
  });

  it("leaves text untouched when maxTextChars is undefined", () => {
    const note = { id: 9, text: `${"y".repeat(5000)}\n\n${DISCLAIMER}` };
    const out = shapeToolText(JSON.stringify(note), { budget: 40000 });
    expect(JSON.parse(out)).toStrictEqual(note);
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

  it("aliases closedFlag on cw_count_opportunities", () => {
    expect(
      normaliseQueryArgs("cw_count_opportunities", { conditions: "closedFlag = false" }),
    ).toEqual({ conditions: "closedDate = null" });
  });

  it("leaves closedFlag alone on opportunity statuses, where it is a real field", () => {
    expect(
      normaliseQueryArgs("cw_list_opportunity_statuses", { conditions: "closedFlag = true" }),
    ).toEqual({ conditions: "closedFlag = true" });
  });

  it("does not rewrite already-qualified paths", () => {
    expect(
      normaliseQueryArgs("cw_search_opportunities", { conditions: "status/closedFlag = false" }),
    ).toEqual({ conditions: "status/closedFlag = false" });
    expect(
      normaliseQueryArgs("cw_get_ticket_notes", { orderBy: "_info/dateCreated desc" }),
    ).toEqual({ orderBy: "_info/dateCreated desc" });
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
