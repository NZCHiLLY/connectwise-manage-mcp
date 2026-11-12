// Generates src/tools/__tests__/fixtures/oversize-notes.json: a synthetic 50-note
// allNotes page shaped like a real ConnectWise response that overflowed the size limit.
// Deterministic (no randomness, no clock) and free of client data.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BANNER = "THIS EMAIL IS FROM AN EXTERNAL SENDER. PLEASE BE CAUTIOUS OF ATTACHMENTS AND LINKS.";
const IMAGE =
  String.raw`![\[image\]](https://aus.myconnectwise.net/v4_6_release/api/inlineimages/tomizone/00000000-0000-0000-0000-000000000000)`;
const DISCLAIMER =
  "This message and its attachments contain confidential information. If you are not the intended recipient, you are strictly prohibited to disclose, copy, distribute or take any action in reliance on the contents of this information. E-mail transmission cannot be guaranteed to be secure or error-free, as information could be intercepted, corrupted, lost, destroyed, arrive late or incomplete, or contain viruses. The sender therefore does not accept liability for any errors or omissions in the contents of this message, which arise as a result of e-mail transmission. If verification is required please request a hard-copy version. Tomizone accepts no liability for the content of this email, or for the consequences of any actions taken on the basis of the information provided, unless that information is subsequently confirmed in writing. Any views or opinions presented in this email are solely those of the author and do not necessarily represent those of Tomizone. WARNING: Computer viruses can be transmitted via email. The recipient should check this email and any attachments for the presence of viruses. Tomizone accepts no liability for any damage caused by any virus transmitted by this email.";

const SHORT = [
  "Thanks, that has fixed it on my side.",
  "Can you call me back on the number in the ticket when you have a moment?",
  "Updated the driver and restarted the print spooler. Please test and let us know.",
  "Confirmed the user can sign in again.",
  "Rebooted the device remotely. Waiting on the user to confirm.",
];

const SENTENCES = [
  "The user reports that the shared mailbox intermittently stops syncing after the morning restart.",
  "We checked the device in the remote console and the agent was last seen roughly twenty minutes earlier.",
  "Event logs show repeated authentication warnings from the same service account over the weekend.",
  "The firewall rule was reviewed and no changes were found in the last thirty days.",
  "A test message was sent from an external address and arrived without delay.",
  "The printer queue was cleared, the spooler service restarted and a test page printed successfully.",
  "We have asked the user to leave the laptop on the dock overnight so the pending updates can complete.",
  "No further errors were logged after the change, so the ticket will stay open for another day for monitoring.",
];

function paragraph(seed, sentences) {
  const out = [];
  for (let i = 0; i < sentences; i++) out.push(SENTENCES[(seed + i) % SENTENCES.length]);
  return out.join(" ");
}

function body(i) {
  const kind = i % 10;
  const sig = `Regards,\nSupport Analyst ${i}\nExample Services Ltd`;
  const para = (n, s) => paragraph(i + n, s);
  switch (kind) {
    case 0:
    case 5:
      return SHORT[i % SHORT.length];
    case 1:
      return i % 20 === 1 ? `${para(0, 4)}\n\n${sig}\n\n${DISCLAIMER}` : `${para(0, 4)}\n\n${sig}`;
    case 2:
      return `${BANNER}\n\n${para(0, 2)}\n\n${sig}\n${IMAGE}`;
    case 3:
      // i = 3 and 23 and 43: the long replies, over 3,000 characters with their disclaimer.
      return i % 20 === 3
        ? `${para(0, 5)}\n\n${para(3, 5)}\n\n${para(5, 5)}\n\n${para(1, 5)}\n\n${sig}\n${IMAGE}\n\n${DISCLAIMER}`
        : `${para(0, 2)}\n\n${sig}\n${IMAGE}`;
    case 4:
      return i % 20 === 4
        ? `${BANNER}\n\n${para(0, 2)}\n\n${sig}\n${IMAGE}\n\n${DISCLAIMER}`
        : `${BANNER}\n\n${para(0, 2)}\n\n${sig}`;
    case 6:
      return `${para(0, 2)}\n\n${sig}\n${IMAGE}`;
    case 7:
      return i % 20 === 7
        ? `${BANNER}\n\n${para(0, 5)}\n\n${para(2, 5)}\n\n${para(4, 4)}\n\n${sig}\n\n${DISCLAIMER}`
        : `${BANNER}\n\n${para(0, 2)}\n\n${sig}`;
    case 8:
      return `${para(0, 2)}\n\n${sig}`;
    default:
      return `${para(0, 2)}\n\n${sig}`;
  }
}

const BASE = "https://aus.myconnectwise.net/v4_6_release/apis/3.0";
const notes = [];
for (let i = 0; i < 50; i++) {
  const day = String(1 + Math.floor(i / 3)).padStart(2, "0");
  const hour = String(8 + (i % 9)).padStart(2, "0");
  const stamp = `2026-10-${day}T${hour}:${String((i * 7) % 60).padStart(2, "0")}:00Z`;
  const isExternal = i % 3 === 0;
  notes.push({
    id: 900000 + i,
    ticketId: 100000,
    ticket: { id: 100000, _info: { ticket_href: `${BASE}/service/tickets/100000` } },
    text: body(i),
    detailDescriptionFlag: i === 0,
    internalAnalysisFlag: i % 4 === 1,
    resolutionFlag: i === 49,
    issueFlag: false,
    internalFlag: false,
    externalFlag: false,
    member: { id: 1000 + (i % 5), identifier: `analyst${i % 5}`, name: `Support Analyst ${i % 5}`, _info: { member_href: `${BASE}/system/members/${1000 + (i % 5)}`, image_href: `${BASE}/system/members/${1000 + (i % 5)}/image` } },
    contact: isExternal
      ? { id: 5000 + (i % 4), name: `Example Contact ${i % 4}` }
      : undefined,
    createdBy: isExternal ? `Example Contact ${i % 4}` : `analyst${i % 5}`,
    processNotifications: true,
    dateCreated: stamp,
    noteType: isExternal ? "Email Contact" : "Ticket Note",
    _info: {
      lastUpdated: stamp,
      updatedBy: isExternal ? `Example Contact ${i % 4}` : `analyst${i % 5}`,
      dateEntered: stamp,
      enteredBy: isExternal ? `Example Contact ${i % 4}` : `analyst${i % 5}`,
      sortByDate: stamp,
    },
  });
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "tools", "__tests__", "fixtures", "oversize-notes.json");
const json = JSON.stringify(notes, null, 2) + "\n";
writeFileSync(out, json);
console.log(`${notes.length} notes, ${json.length} characters`);
