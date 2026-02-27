import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ExternalLink, Facebook, Twitter, Linkedin, Youtube, Instagram } from "lucide-react";
import gcuLogo from "@/assets/gcu-logo.png";
import libraryHero from "@/assets/library-hero.jpg";
import studyHall from "@/assets/academic-search-elite.jpg";
import gcuGLogo from "@/assets/gcu-full-logo.png";

/* ─── EBSCO ─── */
const ebscoChecklist = [
  "1,187 active, full-text, non-open access journals and magazines",
  "977 active, full-text, peer-reviewed, non-open access journals",
  "351 active, full-text, peer-reviewed, non-open access journals with no embargo",
  "886 active, full-text, non-open access journals indexed in Web of Science or Scopus",
];

/* ─── DELNET ─── */
const delnetLeft = [
  { label: "Union CataLogue of Books – CCF", val: "2,92,70,150" },
  { label: "Union List of Current Periodicals", val: "38,184" },
  { label: "Union Catalogue of Periodicals", val: "20,235" },
  { label: "Database of Periodical Articles", val: "11,06,228" },
];
const delnetRight = [
  { label: "Union List of Video Recordings", val: "6,000" },
  { label: "Union List of Sound Recordings", val: "1,025" },
  { label: "Database of Theses and Dissertations", val: "1,30,753" },
  { label: "Database of E-books", val: "1,613" },
];

/* ─── Digital Projects ─── */
const digitalProjects = [
  { name: "SWAYAM", desc: "provides Massive Open Online Courses with 140 universities approved credit transfer feature. Students enrolled in Jan-20 & in total are 26 Lakhs & 1.57 Cr respectably. Total 1900+ courses covering school & higher education.", url: "https://swayam.gov.in/" },
  { name: "SWAYAMPRABHA", desc: "provides high quality educational programs 24*7 through 32 DTH channels. Around 56,000 total videos have been telecasted covering school & higher education. It has 3+ crores total views on Youtube since inception.", url: "https://www.swayamprabha.gov.in/" },
  { name: "National Digital Library (NDL)", desc: "is a repository of e-content on multiple disciplines from primary to PG levels. It has 4.3 crores content (Text / Audio / Video / Simulation /Graphics), harvested from 250 sources; in 300+ languages. NDL has 55 Lakhs + registered users.", url: "https://ndl.iitkgp.ac.in/" },
  { name: "e-Yantra", desc: "provides hands on experience on embedded systems. It has about 380 Lab and made 2300+ colleges benefited.", url: "https://www.e-yantra.org/" },
  { name: "FOSSEE", desc: "is acronym for Free/Libre and Open Source Software for Education, which developed, promote open source softwares for education as well as professional use.", url: "https://fossee.in/" },
  { name: "Virtual Labs", desc: "has developed Web-enabled curriculum based experiments designed for remote – operation. Its 275 labs with 2200+ experiments made 18+ Lakhs students benefitted.", url: "http://www.vlab.co.in/" },
  { name: "e-gyankosh", desc: "is a National Digital Repository to store and share the digital learning resources. Its content developed by the Open and Distance Learning Institutions in the country.", url: "http://egyankosh.ac.in/" },
  { name: "Gyan Darshan", desc: "is a web based TV channel devoted to educational and developmental needs for Open and Distance Learner.", url: "http://www.ignouonline.ac.in/gyandarshan/" },
  { name: "Gyan Vani", desc: "(105.6 FM Radio) & Gyandhara (web radio) Gyan Dhara is an internet audio counselling service where students can listen to the live discussions by the teachers and experts on the topic of the day and interact with them through telephone.", url: "http://ignouonline.ac.in/Gyandhara/" },
  { name: "DIKSHA", desc: "is a National Platform for Our Teachers & all other learner.", url: "https://diksha.gov.in/" },
  { name: "Epathshala", desc: "provides Free access of e-books (class I to XII) through website and app.", url: "http://epathshala.gov.in/" },
  { name: "e-PG Pathshala", desc: "is a gateway for e-books upto PG which provides High quality, curriculum based, and interactive content in different subjects across all disciplines.", url: "http://epathshala.gov.in/" },
  { name: "e-ShodhSindhu", desc: "is a collection of e-journals, e-journal archives and e-books on perpetual access basis. It has 10,000+ e-journals, 31,35,000+ e-books.", url: "https://ess.inflibnet.ac.in/" },
  { name: "Shodhganga", desc: "is a platform for research students to deposit their Ph.D. theses and make it available to the entire scholarly community in open access", url: "https://shodhganga.inflibnet.ac.in/" },
  { name: "Shodh Shudhhi (PDS)", desc: "is a Plagiarism Detection Software Encourage original information by preventing plagiarism.", url: "https://shodhganga.inflibnet.ac.in/" },
  { name: "VIDWAN", desc: "is an Expert Database and National Research Network which has profiles of scientists / researchers and other faculty members working at leading academic institution", url: "https://vidwan.inflibnet.ac.in/" },
  { name: "Spoken Tutorial", desc: "is a Tutorial in IT application which provides self-training in IT fields.", url: "https://spoken-tutorial.org/" },
  { name: "NEAT", desc: "is an AI adaptive learning portal. This is an initiative for skilling of learners in latest technologies through a PPP model.", url: "https://neat.aicte-india.org/" },
  { name: "SAKSHAT", desc: "SAKSHAT is one Stop Education Portal for addressing all the education and learning related needs of students, scholars, teachers and lifelong learners. The portal provides the latest news, press releases, achievements etc related to Ministry of HRD. So visit SAKSHAT to know the world of online learning.", url: "https://sakshat.ac.in/" },
];

/* ─── Library Facilities ─── */
const facilities = [
  "OPAC", "Bar Coding", "Separate Reference books library",
  "Digital Library", "RFID", "GCULIB Software",
  "Reprography service", "SC/ST Book Bank",
];

/* ─── Footer Links ─── */
const aboutLinks = ["Leadership and Governance", "GCU Concept", "UGC Proforma", "IQAC", "Objects of GCU", "Strategic Vision Plan 2030", "Rules and Regulations", "Nationality of Gardenians", "International Students", "International Collaborations"];
const placementLinks = ["About Placement Cell", "Placement Process", "Recruiters", "Placement Reports", "Placement Assistance"];
const admissionLinks = ["Procedure", "Fee Structure", "Apply Online"];
const campusLinks = ["GCU Facilities", "Accommodation", "Student Clubs", "News & Events", "Student Support Cell"];
const quickLinks = ["Contact Us", "Careers", "Grievance Redressal", "Scholarship", "Faculty", "Research", "Privacy Policy", "Terms & Conditions"];


export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ═══ Sticky Enquire Tab ═══ */}
      <a href="/login"
        className="fixed right-0 top-1/3 z-50 font-bold text-xs tracking-wide px-1.5 py-7 shadow-lg"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed", background: "#CC0000", color: "#fff", borderRadius: "4px 0 0 4px", letterSpacing: "1px" }}>
        Enquire Now
      </a>

      {/* ═══ HERO ═══ */}
      <section className="relative flex items-center justify-center overflow-hidden" style={{ height: "80vh", minHeight: 550 }}>
        <div className="absolute top-6 left-6 z-20">
          <img src={gcuLogo} alt="GCU Logo" className="rounded" style={{ height: 80, width: 80, objectFit: "contain" }} />
        </div>
        <img src={libraryHero} alt="GCU Library" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.50), rgba(0,0,0,0.40) 50%, rgba(0,0,0,0.55))" }} />

        <div className="relative z-10 text-center px-4" style={{ maxWidth: 750 }}>
          <h1 className="mb-8" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 64, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
            GCU Library
          </h1>
          <blockquote style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, color: "rgba(255,255,255,0.9)", lineHeight: 1.6 }}>
            "To Build Up a Library is to Create a Life. It's Never Just a Random Collection of Books"
          </blockquote>
          <p className="mt-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>
            – Carlos María Domínguez
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button onClick={() => navigate("/login")}
              className="px-8 py-3 rounded font-semibold tracking-wide transition-all hover:opacity-90"
              style={{ background: "#CC0000", color: "#fff", fontSize: 15 }}>
              Login
            </button>
            <button onClick={() => navigate("/login")}
              className="px-8 py-3 rounded font-semibold tracking-wide transition-all hover:opacity-90"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.6)", fontSize: 15 }}>
              Sign Up
            </button>
          </div>
        </div>
      </section>

      {/* ═══ ABOUT (Quote + Description) ═══ */}
      <section className="py-16 bg-background">
        <div className="mx-auto px-6" style={{ maxWidth: 1200 }}>
          <div className="grid lg:grid-cols-2 gap-0">
            <div style={{ background: "#1a237e", padding: 48 }}>
              <blockquote style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 17, lineHeight: 1.8, color: "#fff" }}>
                "The library is the heart of all university's work directly so as regards its research work and indirectly as regards its educational work which derives its life from research work. Scientific research needs a library as well as its laboratory, while for humanistic research the library is both library and laboratory in one."
              </blockquote>
              <p className="mt-8" style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                – Dr. Sarvepalli Radhakrishnan, 1948
              </p>
            </div>
            <div className="flex flex-col justify-center" style={{ padding: 48 }}>
              <p style={{ fontSize: 16, lineHeight: 1.8, color: "#333", marginBottom: 16 }}>
                Garden City University Library plays a vital role in providing Information Sources and Services to the members of the library. The University library has huge collection of Information sources in various fields like Books, Periodicals, Thesis, Dissertations, Bibliographies, OPAC Service, Reference, Referal Services.
              </p>
              <p style={{ fontSize: 16, lineHeight: 1.8, color: "#333", fontWeight: 700 }}>
                Apart from the above, The University has subscription with various Academic Databases to meet every academic researcher's needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ EBSCO ═══ */}
      <section className="py-16 bg-background">
        <div className="mx-auto px-6" style={{ maxWidth: 1200 }}>
          <h2 className="text-center" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 36, fontWeight: 700, color: "#111", marginBottom: 8 }}>
            Academic Search Elite (EBSCO'S)
          </h2>
          <div className="w-full border-b border-border mt-4 mb-10" />

          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#222", fontWeight: 700, marginBottom: 24 }}>
            Designed to meet every academic researcher's needs, Academic Search Elite provides access to acclaimed full-text scholarly journals and magazines.
          </p>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="mb-4 font-bold text-base" style={{ color: "#CC0000" }}>Content Includes:</p>
              <ul className="mb-8">
                {ebscoChecklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 mb-4">
                    <Check className="h-5 w-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                    <span style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mb-4 font-bold text-base" style={{ color: "#CC0000" }}>Covering All Major Academic Disciplines:</p>
              <div className="flex items-start gap-3 mb-8">
                <Check className="h-5 w-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                <span style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>Academic Search Elite is a rich resource spanning a broad stretch of academic subjects with thousands of full-text journals and abstracted indexed journals. This database is sourced with PDF images for the great majority of journals; many of these PDFs are native (searchable) or scanned-in-color.</span>
              </div>

              <p className="mb-4 font-bold text-base" style={{ color: "#CC0000" }}>Topical Video Content:</p>
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                <span style={{ fontSize: 16, color: "#333", lineHeight: 1.6 }}>Academic Search Elite offers access to video content from the Associated Press, the world's leading news agency. Videos relevant to the search terms will appear in a carousel in the result list. With footage from 1930 to the present and updated monthly, this collection of more than 77,000 videos covers a wide variety of topics.</span>
              </div>
            </div>

            <div className="flex flex-col">
              <img src={studyHall} alt="University study hall" className="w-full object-cover shadow-md" style={{ aspectRatio: "4/3" }} loading="lazy" />
              <div className="mt-6 flex flex-col items-center justify-center gap-4 text-center"
                style={{ background: "linear-gradient(135deg, #880E4F, #AD1457)", padding: "28px 24px", borderRadius: 4 }}>
                <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>
                  Academic Search Elite (EBSCO'S)
                </h3>
                <button onClick={() => navigate("/login")}
                  className="font-bold hover:opacity-90 transition-opacity"
                  style={{ background: "#E65100", color: "#fff", padding: "12px 36px", borderRadius: 4, fontSize: 16 }}>
                  Login / Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DELNET ═══ */}
      <section className="py-16 bg-background">
        <div className="mx-auto px-6" style={{ maxWidth: 1200 }}>
          <div style={{ background: "#CC0000", borderRadius: 4, padding: "14px 32px", marginBottom: 32 }}>
            <h2 className="text-center" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, fontWeight: 700, color: "#fff" }}>
              DELNET Database
            </h2>
          </div>

          <p className="text-center mx-auto" style={{ fontSize: 16, lineHeight: 1.7, color: "#222", fontWeight: 700, maxWidth: 1000, marginBottom: 40 }}>
            It aims to collect, store, and disseminate information besides offering computerized services to users, to coordinate efforts for suitable collection development and also to reduce unnecessary duplication wherever possible.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mx-auto" style={{ maxWidth: 1100, marginBottom: 60 }}>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <tbody>
                {delnetLeft.map((s, i) => (
                  <tr key={i}>
                    <td style={{ background: "#f0f0f0", border: "1px solid #ccc", padding: "14px 16px", fontSize: 15, color: "#333" }}>{s.label}</td>
                    <td style={{ background: "#f0f0f0", border: "1px solid #ccc", padding: "14px 16px", fontSize: 15, color: "#333", fontWeight: 500 }}>{s.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <tbody>
                {delnetRight.map((s, i) => (
                  <tr key={i}>
                    <td style={{ background: "#f0f0f0", border: "1px solid #ccc", padding: "14px 16px", fontSize: 15, color: "#333" }}>{s.label}</td>
                    <td style={{ background: "#f0f0f0", border: "1px solid #ccc", padding: "14px 16px", fontSize: 15, color: "#333", fontWeight: 500 }}>{s.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ PROJECTS TO ASSIST STUDENTS ═══ */}
      <section className="py-16 bg-background">
        <div className="mx-auto px-6" style={{ maxWidth: 1200 }}>
          <div style={{ background: "#1a237e", borderRadius: 4, padding: "14px 32px", marginBottom: 32 }}>
            <h2 className="text-center" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 28, fontWeight: 700, color: "#fff" }}>
              Projects to Assist Students
            </h2>
          </div>

          <p className="text-center mx-auto" style={{ fontSize: 16, lineHeight: 1.7, color: "#222", fontWeight: 700, maxWidth: 1000, marginBottom: 40 }}>
            Apart from this, MHRD initiated a number of projects to assist students, scholars, teachers and lifelong learners in their studies. These initiatives cover educational requirements of learners ranging from school to Post Graduate. The introduction of those projects as follows.
          </p>

          <div className="overflow-x-auto" style={{ border: "1px solid #ccc" }}>
            <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 15 }}>
              <tbody>
                {digitalProjects.map((p, i) => (
                  <tr key={p.name} style={{ background: i % 2 !== 0 ? "#f9f9f9" : "#fff" }}>
                    <td className="align-middle text-center" style={{ border: "1px solid #ccc", padding: "18px 20px", fontWeight: 700, color: "#111", width: 200 }}>{p.name}</td>
                    <td className="align-middle text-center" style={{ border: "1px solid #ccc", padding: "18px 20px", color: "#333", lineHeight: 1.6 }}>{p.desc}</td>
                    <td className="align-middle text-center" style={{ border: "1px solid #ccc", padding: "18px 20px", width: 260 }}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold hover:underline" style={{ color: "#CC0000", fontSize: 14 }}>
                        {p.url} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ LIBRARY FACILITIES ═══ */}
      <section className="py-16 bg-background">
        <div className="mx-auto px-6" style={{ maxWidth: 1200 }}>
          <div style={{ background: "linear-gradient(135deg, #880E4F, #c2185b)", borderRadius: 4, padding: "14px 32px" }}>
            <h2 className="text-center" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 700, color: "#fff" }}>
              Library Facilities
            </h2>
          </div>
          <div style={{ background: "#f0f0f0", padding: "36px 40px" }}>
            <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: "28px 48px" }}>
              {facilities.map(f => (
                <div key={f} className="flex items-center gap-3">
                  <Check className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <span style={{ fontSize: 16, color: "#333", fontWeight: 600 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ background: "linear-gradient(to bottom, rgba(100,0,0,0.92), rgba(80,0,0,0.95))", color: "#fff", paddingTop: 56, paddingBottom: 32 }}>
        <div className="mx-auto px-6" style={{ maxWidth: 1200 }}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 40, marginBottom: 48 }}>

            {/* Col 1 – Logo + Contact */}
            <div>
              <div className="mb-5">
                <img src={gcuGLogo} alt="Garden City University" style={{ height: 56, filter: "brightness(2)" }} className="w-auto object-contain" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Garden City University – Campus</p>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#e88a4a", marginBottom: 14 }}>16th KM, Old Madras Road, Bangalore – 560 049</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Phone: <span style={{ color: "#e88a4a" }}>+91 (80) 66487600</span> / <span style={{ color: "#e88a4a" }}>+91 90-1992-1992</span></p>

              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginTop: 24, marginBottom: 6 }}>Garden City University – City Office</p>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#e88a4a", marginBottom: 14 }}>GCC HOUSE, No. 340 Indiranagar Double Rd, Stage 1, Indiranagar, Bengaluru – 560038,</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Phone: <span style={{ color: "#e88a4a" }}>+91 90-1992-1992</span></p>

              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginTop: 16, marginBottom: 4 }}>Email Us At:</p>
              <p style={{ fontSize: 13, color: "#e88a4a" }}>pro@gcu.edu.in</p>
            </div>

            {/* Col 2 – About + Placements */}
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 14 }}>About GCU</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {aboutLinks.map(l => <li key={l} style={{ marginBottom: 6 }}><button className="hover:underline text-left" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{l}</button></li>)}
              </ul>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 24, marginBottom: 14 }}>Placements</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {placementLinks.map(l => <li key={l} style={{ marginBottom: 6 }}><button className="hover:underline text-left" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{l}</button></li>)}
              </ul>
            </div>

            {/* Col 3 – Admissions + Campus Life + Quick Links */}
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Admissions</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {admissionLinks.map(l => <li key={l} style={{ marginBottom: 6 }}><button className="hover:underline text-left" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{l}</button></li>)}
              </ul>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 24, marginBottom: 14 }}>Campus Life</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {campusLinks.map(l => <li key={l} style={{ marginBottom: 6 }}><button className="hover:underline text-left" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{l}</button></li>)}
              </ul>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 24, marginBottom: 14 }}>Quick Links</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {quickLinks.map(l => <li key={l} style={{ marginBottom: 6 }}><button className="hover:underline text-left" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{l}</button></li>)}
              </ul>
            </div>

            {/* Col 4 – CTA + Social */}
            <div>
              <div style={{ background: "rgba(255,200,200,0.15)", borderRadius: 6, padding: 24, marginBottom: 24 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Interested to join us at GCU?</p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginBottom: 16 }}>We'd love to have you onboard.</p>
                <button className="font-bold hover:opacity-90 transition-opacity"
                  style={{ background: "#CC0000", color: "#fff", padding: "10px 24px", borderRadius: 4, fontSize: 13, letterSpacing: "0.5px" }}>
                  CAREER WITH US
                </button>
              </div>

              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Meet us at Social</h4>
              <div className="flex gap-3 mb-6">
                {[
                  { Icon: Facebook, color: "#1877F2" },
                  { Icon: Twitter, color: "#1DA1F2" },
                  { Icon: Linkedin, color: "#0A66C2" },
                  { Icon: Youtube, color: "#FF0000" },
                  { Icon: Instagram, color: "#E4405F" },
                ].map(({ Icon, color }, i) => (
                  <a key={i} href="#"
                    className="flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{ width: 38, height: 38, borderRadius: "50%", background: color }}>
                    <Icon className="h-4 w-4" style={{ color: "#fff" }} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 24, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
              University established through Act no. 47 of 2013 in Karnataka State and approved by UGC, Govt. of India
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              © 2026, Garden City University. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
