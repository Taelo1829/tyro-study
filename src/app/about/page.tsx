import type { Metadata } from "next"
import Link from "next/link"
import { ProsePage } from "@/components/public/prose-page"
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: `About | ${SITE_NAME}`,
  description: `${SITE_NAME} is an independent study app for UNISA students: study notes, quizzes, flashcards and a study timetable.`,
  alternates: { canonical: "/about" },
}

export default function AboutPage() {
  return (
    <ProsePage title={`About ${SITE_NAME}`}>
      <p>
        {SITE_NAME} is a study app for students at the University of South Africa (UNISA). UNISA is a distance-learning
        university, so most of the studying happens on your own — often part-time, around work and family. {SITE_NAME} is
        built to make that easier.
      </p>
      <h2>What you&apos;ll find here</h2>
      <ul>
        <li><strong>Study notes</strong> for each topic of a module, explained in plain English with worked examples, key ideas and common mistakes. Many are <Link href="/notes">free to read</Link> without an account.</li>
        <li><strong>Practice quizzes</strong> for every topic and chapter, with instant feedback and the topics to revise.</li>
        <li><strong>Flashcards</strong> for quick revision of definitions and key facts.</li>
        <li><strong>A study timetable</strong> for study sessions, assignment due dates and exams.</li>
        <li><strong>Chat</strong> with classmates taking the same modules.</li>
      </ul>
      <h2>How the notes are made</h2>
      <p>
        Lessons are written and organised by the {SITE_NAME} team, following the structure of each module. Some first drafts
        are prepared with the help of AI writing tools and are then reviewed and edited before they are published. If you
        spot a mistake, please let us know.
      </p>
      <h2>Independent</h2>
      <p>
        {SITE_NAME} is an independent project. It is not affiliated with, endorsed by or connected to the University of South
        Africa. Always follow your official UNISA study guides, tutorial letters and myUnisa announcements — they take
        priority over anything on this site.
      </p>
      <h2>Contact</h2>
      <p>
        Questions, corrections or requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </ProsePage>
  )
}
