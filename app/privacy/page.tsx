"use client";
import React from "react";
import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();
  const navy = '#1B2B4B'
  const gold = '#C9A84C'

  return (
    <main style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');`}</style>

      {/* Nav */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="SGHomeValuation" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 17, color: navy }}>
            SG<span style={{ color: gold }}>Home</span>Valuation
          </span>
        </a>
        <button
          onClick={() => router.back()}
          style={{ fontSize: 13, color: navy, background: "none", border: `1px solid ${navy}`, cursor: "pointer", fontWeight: 600, padding: "6px 12px", borderRadius: 8 }}
        >
          ← Back
        </button>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 6 }}>Privacy Policy &amp; Consent</h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 40 }}>Last updated: April 2026</p>

        {/* Consent Statement */}
        <section style={{ background: "#EFF4FB", border: `1px solid ${navy}30`, borderRadius: 16, padding: "24px", marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: navy, marginBottom: 12 }}>Consent Statement</h2>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75 }}>
            By submitting this form, I confirm that I have read, acknowledge and authorise Rewardhub Digital Pte. Ltd. (&ldquo;Rewardhub&rdquo;) and their Representatives to collect, use, disclose and retain my personal data for the purpose of contacting me for the provision of a free property valuation and related financial advisory services.
          </p>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, marginTop: 12 }}>
            By submitting your personal details, you confirm that you have read and understood this Privacy Policy and consent to Rewardhub Digital Pte. Ltd. collecting, using, disclosing and retaining your personal data for the following purposes:
          </p>
          <ul style={{ fontSize: 14, color: "#374151", lineHeight: 1.85, marginTop: 10, paddingLeft: 20 }}>
            <li>To contact you regarding your property valuation enquiry or request</li>
            <li>To connect you with a licensed property consultant</li>
            <li>To provide you with information, advice, and recommendations relating to financial advisory services</li>
            <li>To disclose and transfer your personal data to licensed financial advisory representatives strictly for follow-up and servicing of your enquiry</li>
          </ul>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, marginTop: 12 }}>
            You acknowledge and agree that your personal data may be transferred as part of a commercial lead generation arrangement to the above parties for the purposes stated.
          </p>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, marginTop: 12 }}>
            You confirm that the personal data provided is accurate and that you are the user/subscriber of the contact details submitted.
          </p>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, marginTop: 12 }}>
            You agree and consent to Rewardhub Digital Pte. Ltd. contacting you via <strong>phone calls, SMS, WhatsApp, and email</strong> for marketing, promotional, and advisory purposes relating to financial products, services, and property matters, <strong>even if your telephone number is registered with the Singapore Do Not Call Registry (DNCR)</strong>.
          </p>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.75, marginTop: 12 }}>
            You understand that you may withdraw this consent at any time.
          </p>
        </section>

        <Section title="1. Introduction" navy={navy}>
          <p>This Privacy Policy describes how Rewardhub Digital Pte. Ltd. (&ldquo;Rewardhub&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, discloses and protects your personal data in accordance with the Personal Data Protection Act 2012 (PDPA) of Singapore.</p>
          <p>Rewardhub acts as the data controller for the personal data collected through SGHomeValuation.com.</p>
        </Section>

        <Section title="2. Personal Data We Collect" navy={navy}>
          <p>We may collect personal data including:</p>
          <ul>
            <li>Name</li>
            <li>Mobile number</li>
            <li>Property postal code</li>
            <li>Unit type and floor level</li>
            <li>Any other information voluntarily provided by you</li>
          </ul>
          <p style={{ marginTop: 10 }}>We may also collect technical data such as IP address, browser type, device information, and website interaction data (via cookies).</p>
        </Section>

        <Section title="3. Purpose of Collection" navy={navy}>
          <p>Your personal data is collected and used for the following purposes:</p>
          <ul>
            <li>Providing you with a free property valuation report</li>
            <li>Connecting you with licensed property consultants</li>
            <li>Providing financial advisory-related information and recommendations</li>
            <li>Facilitating contact with licensed financial advisory representatives</li>
            <li>Marketing, promotions, and offers (where consent is given)</li>
            <li>Internal analysis, lead qualification, and service improvement</li>
          </ul>
        </Section>

        <Section title="4. Disclosure and Transfer of Personal Data" navy={navy}>
          <p>We may disclose and transfer your personal data to:</p>
          <ul>
            <li><strong>Licensed Property Consultants</strong> — for the purpose of delivering your property valuation</li>
            <li><strong>Financial Advisory Representatives</strong> — licensed financial advisers engaged by Rewardhub Digital</li>
            <li><strong>Service Providers</strong> — CRM systems, cloud hosting providers, marketing platforms, analytics tools</li>
            <li><strong>Commercial Lead Arrangement</strong> — We may transfer your personal data as part of a commercial lead generation arrangement to licensed financial advisory representatives, strictly for the purposes stated in this Policy</li>
            <li><strong>Legal Disclosure</strong> — Where required by law, regulation, or legal process</li>
          </ul>
          <p style={{ marginTop: 10 }}>We do not disclose your personal data to unrelated third parties outside the above scope without your consent.</p>
        </Section>

        <Section title="5. Marketing &amp; DNCR Compliance" navy={navy}>
          <p>Where you have provided consent, you may receive communications via calls, SMS, WhatsApp, and email. This applies even if your number is listed on the Do Not Call Registry (DNCR). You may withdraw your consent at any time.</p>
        </Section>

        <Section title="6. Cookies and Tracking Technologies" navy={navy}>
          <p>We use cookies and similar technologies to analyse website performance, improve user experience, and optimise marketing campaigns. You may disable cookies via your browser settings.</p>
        </Section>

        <Section title="7. Data Security" navy={navy}>
          <p>We implement reasonable security measures including restricted access to personal data, secure storage systems, and use of reputable service providers. However, no system is completely secure and we do not guarantee absolute security.</p>
        </Section>

        <Section title="8. Data Retention" navy={navy}>
          <p>We retain personal data only for as long as necessary to fulfil the purposes stated in this Policy and to comply with legal and regulatory requirements. Data will be securely deleted or anonymised when no longer required.</p>
        </Section>

        <Section title="9. Consent Records and Traceability" navy={navy}>
          <p>We maintain records of your consent, including date and time of submission, method and source of collection, and version of consent wording accepted. These records are retained for audit and regulatory compliance purposes.</p>
        </Section>

        <Section title="10. Access, Correction and Withdrawal" navy={navy}>
          <p>You may request access to your personal data, request correction of inaccurate data, or withdraw your consent at any time. Please contact:</p>
          <p style={{ marginTop: 8 }}><strong>📧 </strong><a href="mailto:hello.rewardhub@gmail.com" style={{ color: navy }}>hello.rewardhub@gmail.com</a></p>
          <p style={{ marginTop: 4 }}>We will respond within a reasonable timeframe (generally within 14 days).</p>
        </Section>

        <Section title="11. Withdrawal of Consent" navy={navy}>
          <p>Upon withdrawal of consent, we will cease using your personal data for the specified purposes. This may affect our ability to provide services to you.</p>
        </Section>

        <Section title="12. Changes to This Policy" navy={navy}>
          <p>We may update this Privacy Policy from time to time. The latest version will always be made available on our website.</p>
        </Section>

        <div style={{ marginTop: 40, padding: "20px 24px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, fontSize: 13, color: "#6B7280", textAlign: "center" }}>
          © {new Date().getFullYear()} Rewardhub Digital Pte. Ltd. All rights reserved.
        </div>
      </div>
    </main>
  );
}

function Section({ title, children, navy }: { title: string; children: React.ReactNode; navy: string }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #F3F4F6" }}>{title}</h2>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.8 }}>
        {children}
      </div>
      <style>{`section ul { padding-left: 20px; margin-top: 8px; } section ul li { margin-bottom: 4px; } section p { margin-bottom: 0; } a { color: ${navy}; }`}</style>
    </section>
  );
}
