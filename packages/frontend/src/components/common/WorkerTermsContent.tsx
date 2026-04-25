export function WorkerTermsContent() {
  return (
    <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
          Project Tabang — Barangay Service Platform
        </p>
        <h2 className="text-xl font-bold text-slate-900 mt-1">
          Worker Terms and Conditions
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          By registering as a Worker, you agree to all terms stated in this document.
        </p>
      </div>

      {/* Section 1 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          1. Introduction and Acceptance
        </h3>
        <p>
          These Terms and Conditions ("Terms") govern your registration and participation as a Service
          Worker ("Worker") in the Project Tabang platform ("Platform"), operated by the Barangay
          through Project Tabang. By completing your registration and accepting these Terms, you agree
          to be fully bound by all provisions stated herein.
        </p>
        <p>
          These Terms exist to protect both Workers and Residents, ensure fair and professional
          service delivery, and maintain the integrity of the barangay service community.
        </p>
      </section>

      {/* Section 2 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          2. Eligibility and Registration
        </h3>
        <ul className="list-disc ml-5 space-y-1">
          <li>Worker registration is processed exclusively by the Barangay Admin. Self-registration is not permitted.</li>
          <li>You must be a recognized resident or member of the barangay to be eligible.</li>
          <li>You must possess genuine skills in the specialization(s) you declare at registration.</li>
          <li>Valid credentials or certifications may be required and submitted during registration.</li>
          <li>Your account must be verified by the Barangay Admin before you can receive job assignments.</li>
          <li>Providing false information during registration is grounds for immediate account termination.</li>
        </ul>
      </section>

      {/* Section 3 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          3. Service Process
        </h3>
        <p className="font-medium text-slate-800">The following steps outline how a typical job works:</p>
        <div className="space-y-3">
          <div className="flex gap-3 bg-slate-50 rounded-lg p-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">1</span>
            <div>
              <p className="font-semibold text-slate-800">Auto-Assignment</p>
              <p className="text-xs text-slate-600 mt-0.5">
                The system automatically assigns service requests to you based on your specialization,
                location, rating, and assignment history. You will be notified when a job is assigned.
              </p>
            </div>
          </div>
          <div className="flex gap-3 bg-slate-50 rounded-lg p-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">2</span>
            <div>
              <p className="font-semibold text-slate-800">Travel to Location</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Travel to the resident's location on the scheduled date and time. You are expected
                to be punctual. Notify the resident or admin in advance if you are unable to make it.
              </p>
            </div>
          </div>
          <div className="flex gap-3 bg-slate-50 rounded-lg p-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">3</span>
            <div>
              <p className="font-semibold text-slate-800">Arrival & Price Confirmation</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Upon arrival, assess the job. If the actual scope differs from what was described,
                you may propose a revised final price. Your final price cannot exceed 2× the
                resident's originally suggested price without prior Barangay Admin approval.
              </p>
            </div>
          </div>
          <div className="flex gap-3 bg-slate-50 rounded-lg p-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">4</span>
            <div>
              <p className="font-semibold text-slate-800">Perform the Service</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Carry out the service with professionalism, competence, and care. You are
                responsible for the quality and safety of all work performed.
              </p>
            </div>
          </div>
          <div className="flex gap-3 bg-slate-50 rounded-lg p-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">5</span>
            <div>
              <p className="font-semibold text-slate-800">Mark as Complete</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Once the work is done, mark the job as completed in the Platform. The resident
                will then submit proof of payment.
              </p>
            </div>
          </div>
          <div className="flex gap-3 bg-slate-50 rounded-lg p-3">
            <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">6</span>
            <div>
              <p className="font-semibold text-slate-800">Payment Confirmation</p>
              <p className="text-xs text-slate-600 mt-0.5">
                The Barangay Admin reviews and confirms the payment proof. The job is marked
                fully complete after confirmation. Your earnings are your stated price in full.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4 */}
      <section className="space-y-3">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          4. Payment and Commission Structure
        </h3>

        <div>
          <p className="font-semibold text-slate-800 mb-1">4.1 Your Pricing</p>
          <p>
            You set your own price for the service upon arrival, after assessing the actual scope
            of work. The resident's suggested price shown at request time is a reference — your
            final stated price governs payment.
          </p>
        </div>

        <div>
          <p className="font-semibold text-slate-800 mb-1">4.2 Barangay Commission (10%)</p>
          <p>
            A <strong>10% Barangay Service Fee</strong> is charged on top of your stated price and
            is paid by the resident — <strong>not deducted from your earnings</strong>. You receive
            100% of your stated price.
          </p>
          <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-800 text-xs">
            <p className="font-semibold mb-1">Example:</p>
            <p>Your stated price: <strong>₱500</strong></p>
            <p>Resident pays: <strong>₱550</strong> (₱500 to you + ₱50 barangay fee)</p>
            <p>You receive: <strong>₱500</strong></p>
          </div>
        </div>

        <div>
          <p className="font-semibold text-slate-800 mb-1">4.3 Tips</p>
          <p>
            Residents may optionally add a tip when submitting a request. If a tip is provided,
            you receive the full tip amount in addition to your stated price. Tips are not subject
            to the commission and are entirely yours.
          </p>
        </div>

        <div>
          <p className="font-semibold text-slate-800 mb-1">4.4 Price Cap</p>
          <p>
            Your final stated price must not exceed <strong>2× the resident's originally suggested price</strong> without
            explicit Barangay Admin approval. Price overrides above this cap are flagged and require
            Admin review before the job can proceed.
          </p>
        </div>

        <div>
          <p className="font-semibold text-slate-800 mb-1">4.5 Payment Methods</p>
          <ul className="list-disc ml-5 space-y-1 text-xs text-slate-600">
            <li>Accepted methods: <strong>GCash</strong> or <strong>Cash</strong> (as selected by the resident at the time of request).</li>
            <li>Payment is made directly by the resident to you after service completion.</li>
            <li>The resident then submits proof of payment (photo/screenshot) through the Platform.</li>
            <li>The Barangay Admin reviews the proof and confirms the payment before the job is fully closed.</li>
            <li>Do not demand payment outside the Platform's confirmed process.</li>
          </ul>
        </div>
      </section>

      {/* Section 5 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          5. Credit Points System
        </h3>
        <p>
          Credit Points are your performance standing within the Platform, ranging from
          <strong> 1 (lowest)</strong> to <strong>5 (highest)</strong>. They directly affect
          your ability to receive job assignments.
        </p>
        <div className="grid grid-cols-1 gap-2 mt-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-xs">
            <p className="font-semibold text-emerald-800">3–5 Points — Active</p>
            <p className="text-emerald-700">You are eligible to receive job assignments.</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-xs">
            <p className="font-semibold text-yellow-800">2 Points — Auto-Suspended</p>
            <p className="text-yellow-700">Your account is automatically suspended pending Barangay review.</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-xs">
            <p className="font-semibold text-red-800">1 Point — At Risk of Ban</p>
            <p className="text-red-700">Your account may be permanently banned after review.</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Credit points are deducted for cancellations after acceptance, no-shows, verified
          complaints, and misconduct. They may be restored by the Barangay Admin following review.
          All Workers begin with 5 credit points upon registration.
        </p>
      </section>

      {/* Section 6 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          6. Auto-Assignment Algorithm
        </h3>
        <p>
          Job assignments are computed automatically. You will only receive assignments when your
          availability status is set to <strong>Available</strong>. The assignment score is based on:
        </p>
        <div className="space-y-1.5 mt-1">
          <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 text-xs">
            <span className="font-bold text-primary-700 w-10 shrink-0">50%</span>
            <span><strong>Assignment Frequency</strong> — Workers who have received fewer recent jobs are prioritized to ensure fair distribution.</span>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 text-xs">
            <span className="font-bold text-primary-700 w-10 shrink-0">35%</span>
            <span><strong>Average Rating</strong> — Higher-rated workers are given preference in matching.</span>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 text-xs">
            <span className="font-bold text-primary-700 w-10 shrink-0">15%</span>
            <span><strong>Proximity</strong> — Workers located closest to the resident's address are favored.</span>
          </div>
        </div>
      </section>

      {/* Section 7 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          7. Worker Responsibilities
        </h3>
        <p>As a registered Worker, you are obligated to:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Arrive at the scheduled date and time, or provide advance notice if unable to attend.</li>
          <li>Perform all services honestly, competently, and professionally.</li>
          <li>Treat residents with dignity and respect at all times, regardless of circumstances.</li>
          <li>Accurately represent your skills, qualifications, and the work performed.</li>
          <li>Not solicit or demand payments outside the Platform's confirmed process.</li>
          <li>Not engage in fraudulent, abusive, discriminatory, or exploitative behavior.</li>
          <li>Keep your availability schedule accurate to prevent missed or unintended assignments.</li>
          <li>Maintain updated and accurate contact information in your profile.</li>
          <li>Protect the privacy and safety of residents whose homes or properties you visit.</li>
        </ul>
      </section>

      {/* Section 8 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          8. Worker Rights
        </h3>
        <p>As a registered Worker, you are entitled to:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Receive <strong>100% of your stated service price</strong> upon confirmed payment.</li>
          <li>Receive any resident tips in full, without any deduction.</li>
          <li>Set and adjust your own pricing within the allowable limits (up to 2× suggested price).</li>
          <li>Manage and update your availability schedule freely.</li>
          <li>File a dispute against a resident for non-payment, false claims, or abusive behavior.</li>
          <li>Be informed of any credit point deductions, including the specific reason.</li>
          <li>Appeal any suspension, credit deduction, or ban by visiting the Barangay office.</li>
          <li>Have disputes mediated fairly and impartially by the Barangay Admin.</li>
        </ul>
      </section>

      {/* Section 9 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          9. Cancellation Policy
        </h3>
        <div>
          <p className="font-semibold text-slate-800 mb-1">9.1 Worker Cancellation (Before Arrival)</p>
          <p>
            If you are unable to fulfill an assignment, notify the Barangay Admin and the resident
            as early as possible. Repeated pre-arrival cancellations will result in credit point
            deductions and may lead to suspension.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-800 mb-1">9.2 Resident Cancellation After Your Arrival</p>
          <p>
            If a resident cancels the service after you have already arrived at the location, a
            <strong> 20% cancellation penalty</strong> (calculated from the resident's originally
            suggested price) is assessed against the resident. You are entitled to receive this
            penalty amount as compensation for your time and travel.
          </p>
        </div>
      </section>

      {/* Section 10 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          10. Dispute Resolution
        </h3>
        <ul className="list-disc ml-5 space-y-1">
          <li>Either the Worker or the Resident may file a dispute through the Platform.</li>
          <li>Disputable situations include: non-payment, incomplete work, property damage, false claims, or abusive behavior.</li>
          <li>The Barangay Admin acts as the sole mediator and final arbitrator for all disputes.</li>
          <li>During an active dispute, payment or job completion may be withheld until resolution.</li>
          <li>The Barangay Admin's decision is final and binding within the Platform.</li>
          <li>If you disagree with a decision, you may raise the matter in person at the Barangay office.</li>
        </ul>
      </section>

      {/* Section 11 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          11. Ratings and Reviews
        </h3>
        <ul className="list-disc ml-5 space-y-1">
          <li>After a job is completed and payment confirmed, residents may rate your service from 1 to 5 stars.</li>
          <li>Your average rating directly affects your job assignment priority (35% of assignment score).</li>
          <li>Your average rating is visible to the Barangay Admin and may be reviewed at any time.</li>
          <li>Individual ratings cannot be disputed; however, patterns of clearly unfair or malicious ratings may be raised with the Barangay Admin.</li>
        </ul>
      </section>

      {/* Section 12 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          12. Liabilities
        </h3>
        <div>
          <p className="font-semibold text-slate-800 mb-1">12.1 Your Liability as Worker</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>You are personally responsible for the quality and safety of all work you perform.</li>
            <li>Property damage caused during service is your liability and must be settled with the resident, either directly or through Barangay dispute resolution.</li>
            <li>You are responsible for any harm resulting from negligent, reckless, dishonest, or criminal conduct.</li>
            <li>The Barangay will not be held liable for your individual actions while on the job.</li>
          </ul>
        </div>
        <div className="mt-2">
          <p className="font-semibold text-slate-800 mb-1">12.2 Platform Limitations</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Project Tabang and the Barangay are not liable for physical injuries, accidents, or property damage occurring during service delivery.</li>
            <li>The Platform facilitates connections between residents and workers but does not employ workers or guarantee job outcomes.</li>
            <li>The Barangay is not responsible for disputes that arise or persist outside the Platform.</li>
          </ul>
        </div>
      </section>

      {/* Section 13 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          13. Account Suspension and Termination
        </h3>
        <div>
          <p className="font-semibold text-slate-800 mb-1">Your account may be suspended if:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Your credit points fall to 2 or below.</li>
            <li>You are found to have violated these Terms.</li>
            <li>A dispute resolution rules significantly against you.</li>
            <li>You engage in conduct that the Barangay Admin deems inappropriate or harmful.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-slate-800 mb-1">Your account may be permanently banned if:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Your credit points reach 1 after repeated violations.</li>
            <li>You engage in fraud, violence, theft, or gross misconduct.</li>
            <li>You continue violating these Terms after a prior suspension.</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          You may appeal any suspension or ban by visiting the Barangay office in person.
          The Barangay Admin will review the case and issue a decision.
        </p>
      </section>

      {/* Section 14 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          14. Amendments
        </h3>
        <p>
          The Barangay reserves the right to update or amend these Terms at any time.
          Continued use of the Platform after any changes constitutes acceptance of the
          revised Terms. Significant changes will be communicated through the Platform.
        </p>
      </section>

      {/* Section 15 */}
      <section className="space-y-2">
        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-1">
          15. Governing Authority
        </h3>
        <p>
          These Terms are governed by the rules and regulations of the Barangay, in accordance
          with applicable Philippine laws and the Local Government Code of the Philippines.
          Any unresolved matters shall be subject to barangay-level mediation before escalation
          to higher authorities.
        </p>
      </section>

      <div className="border-t border-slate-200 pt-4 text-xs text-slate-400 text-center">
        Project Tabang — Barangay Service Platform &nbsp;|&nbsp; All Rights Reserved
      </div>
    </div>
  );
}
