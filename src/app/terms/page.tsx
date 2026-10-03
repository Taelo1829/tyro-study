import type { Metadata } from "next"
import Link from "next/link"
import { ProsePage } from "@/components/public/prose-page"
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: `Terms of Use | ${SITE_NAME}`,
  description: `The terms for using ${SITE_NAME}.`,
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  return (
    <ProsePage title="Terms of Use" updated="3 October 2026">
      <p>By creating an account or using {SITE_NAME}, you agree to these terms.</p>

      <h2>The service</h2>
      <p>
        {SITE_NAME} provides study notes, quizzes, flashcards, a study timetable and chat to help students with their
        studies. It is an independent service and is not affiliated with or endorsed by the University of South Africa
        (UNISA).
      </p>

      <h2>Study material</h2>
      <p>
        We work hard to keep our notes and quizzes accurate, but they are study aids, not official course material. Always
        follow your official UNISA study guides, tutorial letters and announcements. We can&apos;t guarantee results in
        assignments or exams. Our notes are for your personal study — please don&apos;t copy and republish them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>One account per person. Keep your password private; you&apos;re responsible for activity on your account.</li>
        <li>Give accurate details when you sign up.</li>
        <li>You can ask us to delete your account at any time.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don&apos;t use {SITE_NAME} to:</p>
      <ul>
        <li>harass, threaten or abuse others, or share hateful, sexual or illegal content in chat;</li>
        <li>share other people&apos;s copyrighted material without permission, or share assessment answers in breach of UNISA&apos;s rules;</li>
        <li>try to break, overload or get unauthorised access to the service.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>

      <h2>Your content</h2>
      <p>
        You keep ownership of what you upload or send (messages, images, voice notes, assignment files). You give us
        permission to store and process it to run the service, as described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Advertising</h2>
      <p>{SITE_NAME} shows ads from Google AdSense, which help keep the service free.</p>

      <h2>Liability</h2>
      <p>
        {SITE_NAME} is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect losses,
        or for decisions you make based on the study material. Nothing in these terms limits rights you have under the
        Consumer Protection Act.
      </p>

      <h2>Changes and law</h2>
      <p>
        We may update these terms and will change the date above when we do. These terms are governed by the laws of the
        Republic of South Africa.
      </p>

      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </ProsePage>
  )
}
