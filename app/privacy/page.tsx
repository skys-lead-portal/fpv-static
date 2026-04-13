export default function PrivacyPolicy() {
  const navy = '#1B2B4B'
  const gold = '#C9A84C'

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: '#fff', minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');`}</style>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E8EDF5', padding: '0 48px', display: 'flex', alignItems: 'center', height: '64px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="SGHomeValuation" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '17px', fontWeight: 700, color: navy }}>
            SG<span style={{ color: gold }}>Home</span>Valuation
          </span>
        </a>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 32px 80px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '32px', fontWeight: 700, color: navy, marginBottom: '8px' }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '40px' }}>Last updated: April 2026</p>

        {[
          {
            title: '1. Introduction',
            body: `SGHomeValuation.com is operated by SKYS Branch Pte Ltd ("SKYS", "we", "our", "us"), a company incorporated in Singapore (UEN: 202204232K). We are committed to protecting your personal data in accordance with the Personal Data Protection Act 2012 (PDPA) of Singapore.`,
          },
          {
            title: '2. Data We Collect',
            body: `When you submit the property valuation form, we collect: your full name, mobile number, property postal code, unit type, and floor level. This information is collected solely for the purpose of providing you with a free property valuation consultation.`,
          },
          {
            title: '3. How We Use Your Data',
            body: `Your personal data is used to: (a) contact you regarding your property valuation enquiry; (b) connect you with a licensed property consultant from Singapore's top agencies; (c) provide financial advisory information relating to products distributed by Manulife Financial Advisers Pte Ltd, where applicable.`,
          },
          {
            title: '4. Consent & Do Not Call Registry',
            body: `By submitting the form, you consent to SKYS Branch Pte Ltd collecting, using, disclosing and retaining your personal data for the purposes described above. You consent to being contacted via phone, SMS, WhatsApp, and email, even if your number is listed on the Do Not Call Registry (DNCR). You may withdraw your consent at any time by contacting us at hello@skysleads.com.`,
          },
          {
            title: '5. Disclosure of Data',
            body: `We may share your personal data with licensed property consultants from ERA Real Estate, Huttons, PropNex, and OrangeTee & Tie, solely for the purpose of fulfilling your property valuation request. We do not sell your personal data to third parties.`,
          },
          {
            title: '6. Data Retention',
            body: `We retain your personal data for as long as necessary to fulfil the purpose it was collected for, or as required by applicable laws and regulations. You may request deletion of your data at any time by contacting us.`,
          },
          {
            title: '7. Data Security',
            body: `We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, disclosure, alteration, or destruction. Your data is stored on secured servers hosted in Singapore.`,
          },
          {
            title: '8. Your Rights',
            body: `Under the PDPA, you have the right to: (a) access your personal data held by us; (b) correct any inaccuracies in your personal data; (c) withdraw consent for the use of your personal data. To exercise any of these rights, please contact us at hello@skysleads.com.`,
          },
          {
            title: '9. Contact Us',
            body: `For any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact:\n\nSKYS Branch Pte Ltd\n1 Pearl Bank, #08-12, One Pearl Bank\nSingapore 169016\nEmail: hello@skysleads.com`,
          },
        ].map(({ title, body }) => (
          <div key={title} style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: navy, marginBottom: '10px' }}>{title}</h2>
            <p style={{ fontSize: '14px', color: '#4A5568', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{body}</p>
          </div>
        ))}

        <div style={{ marginTop: '48px', padding: '20px 24px', background: '#F8FAFD', borderRadius: '8px', border: '1px solid #E8EDF5' }}>
          <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.7, margin: 0 }}>
            This Privacy Policy is governed by the laws of Singapore. By using SGHomeValuation.com, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <a href="/" style={{ color: navy, fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>← Back to Home</a>
        </div>
      </div>
    </div>
  )
}
