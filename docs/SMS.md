# SMS check-in simulator

The **SMS check-in** panel is a browser-only mock. It does not send or receive real text
messages and has no backend. The household data is synthetic, and check-ins, unverified road
reports and their verification counts exist only in React state for the current page session;
refreshing the page clears them.

The simulator accepts `1` (safe), `2` (need help), `3` (road blocked), `4` (medical
help), and free text. A `2` records an unverified help request; a `4` fills a missing
medical-need value but does not overwrite a known value. These help/medical changes are
unverified and affect the illustrative priority score. Every applied check-in is counted
as an unverified report and does **not** raise confidence, which measures completeness
only. A `3` creates an unverified report only; it does not close a road or change the
model. Offline mode holds messages in local React state and applies them when the toggle
is turned off.

## What a real deployment would need

- An SMS gateway such as Twilio, plus a server-side integration for inbound and outbound
  messages, delivery failures, retries, and operational monitoring.
- Clear, accessible consent and opt-out flows, including an explanation of how location
  and help requests will be used.
- Verification of phone ownership and message authenticity, with protections against
  spoofing, abuse, replay, and accidental duplicate reports.
- A staffed process to triage urgent requests and verify reports before changing road
  access or dispatch decisions.
- Legal and regulatory review, language support, retention rules, access controls, and
  a tested incident-response and service-continuity plan.

## Privacy notes and limitations

This demo includes no real phone numbers and contacts no gateway. In a real service,
phone numbers and message contents could reveal identity, location, health needs, or
disaster exposure. Collect only what is necessary, restrict access, encrypt data in
transit and at rest, define short retention periods, and provide a way to request
deletion.

SMS reports are not verified evidence. This simulation does not confirm a sender's
identity, geolocate a message, associate a blocked-road report with a road segment,
trigger dispatch, persist data, or sync with a server. Verification counts and
priority weights are illustrative, not validated for operational decisions. This
simulator must not be used as an emergency service.
