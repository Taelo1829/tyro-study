import type { Metadata } from "next"
import { ProsePage } from "@/components/public/prose-page"
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `How ${SITE_NAME} collects, uses and protects your information, including cookies and advertising.`,
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy" updated="3 October 2026">
      <p>
        This policy explains what information {SITE_NAME} (&ldquo;we&rdquo;) collects, how we use it and the choices you
        have. We process personal information in line with South Africa&apos;s Protection of Personal Information Act
        (POPIA).
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and password (stored only in encrypted, hashed form).</li>
        <li><strong>Study activity:</strong> the modules you join, quiz answers and scores, your study streak, and the sessions and due dates you add to your timetable.</li>
        <li><strong>Chat:</strong> messages, images and voice notes you send, your friends list, and your online status and when you were last active.</li>
        <li><strong>Assignments:</strong> code files you submit for automatic feedback.</li>
        <li><strong>Notifications:</strong> if you turn on notifications, a browser push subscription so we can alert you to new messages.</li>
        <li><strong>Technical information:</strong> like most websites, our hosting provider records basic request logs (such as IP address, browser type and pages requested) to keep the service secure and working.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account and show your modules, progress, timetable and chats.</li>
        <li>To send emails you ask for, such as password-reset links.</li>
        <li>To give automatic feedback on assignment submissions.</li>
        <li>To keep the service secure, fix problems and improve it.</li>
        <li>To show advertising on public pages and in the app (see below), which helps keep {SITE_NAME} free.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Service providers</h2>
      <p>We use trusted providers to run {SITE_NAME}. They only process information to provide their service to us:</p>
      <ul>
        <li><strong>Vercel</strong> — website hosting and file storage (uploaded images, voice notes and PDFs).</li>
        <li><strong>Our database provider</strong> — stores account and study data.</li>
        <li><strong>Pusher</strong> — delivers chat messages and online status in real time.</li>
        <li><strong>Resend</strong> — sends account emails such as password resets.</li>
        <li><strong>OpenAI</strong> — generates automatic feedback on assignment submissions (the code you submit is sent for this), and helps our team draft study material.</li>
        <li><strong>Google AdSense</strong> — shows advertising (see below).</li>
      </ul>
      <p>Some of these providers store data outside South Africa, with safeguards required by POPIA.</p>

      <h2>Cookies and advertising</h2>
      <p>
        We use an essential cookie to keep you signed in. We also use Google AdSense to show ads. Google and its partners
        use cookies to serve ads based on your previous visits to this and other websites. Google&apos;s use of
        advertising cookies enables it and its partners to serve ads to you based on your visits to {SITE_NAME} and/or
        other sites on the Internet.
      </p>
      <ul>
        <li>You can opt out of personalised advertising in <a href="https://www.google.com/settings/ads" rel="noopener noreferrer" target="_blank">Google Ads Settings</a>.</li>
        <li>You can opt out of some third-party vendors&apos; use of cookies for personalised advertising at <a href="https://www.aboutads.info/choices" rel="noopener noreferrer" target="_blank">www.aboutads.info</a>.</li>
        <li>Learn more in <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer" target="_blank">How Google uses information from sites that use its services</a>.</li>
      </ul>
      <p>You can also block or delete cookies in your browser settings; if you block the sign-in cookie you won&apos;t be able to log in.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account is active. If you ask us to delete your account, we delete your
        account, study activity and chats, except where we must keep something by law.
      </p>

      <h2>Your rights</h2>
      <p>
        You may ask to see the personal information we hold about you, to correct it, or to delete it, and you may object
        to how we use it. Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If you are not happy with our
        response, you can complain to the Information Regulator of South Africa.
      </p>

      <h2>Children</h2>
      <p>{SITE_NAME} is meant for university students and is not directed at children under 13.</p>

      <h2>Changes</h2>
      <p>We may update this policy. We&apos;ll change the date above when we do, and tell you in the app about important changes.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </ProsePage>
  )
}
