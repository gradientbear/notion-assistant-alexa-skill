'use client';

import { Header } from '@/app/components/Header';
import { Card } from '@/app/components/Card';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
          
          <div className="prose prose-gray max-w-none space-y-6">
            <p className="text-sm text-gray-600 mb-4">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4">
                Notion Data ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Alexa skill and web services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.1 Account Information</h3>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Email address</li>
                <li>Authentication credentials (managed by Supabase Auth)</li>
                <li>License key information</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.2 Notion Data</h3>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Notion workspace access token (OAuth token)</li>
                <li>Task data (task names, priorities, status, due dates, categories)</li>
                <li>Shopping list items</li>
                <li>Focus session logs</li>
                <li>Energy level tracking data</li>
                <li>Database IDs and page IDs created in your Notion workspace</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.3 Alexa Usage Data</h3>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Amazon account ID (for account linking)</li>
                <li>Voice command interactions</li>
                <li>Skill usage patterns</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">2.4 Technical Data</h3>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>IP addresses</li>
                <li>Device information</li>
                <li>Log data and error reports</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>To provide and maintain our services</li>
                <li>To authenticate and authorize your access to the skill</li>
                <li>To create and manage tasks, shopping lists, and logs in your Notion workspace</li>
                <li>To process license purchases and manage subscriptions</li>
                <li>To improve our services and user experience</li>
                <li>To respond to your inquiries and provide customer support</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Data Storage and Security</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">4.1 Data Storage</h3>
              <p className="text-gray-700 mb-4">
                Your data is stored in the following locations:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li><strong>Supabase:</strong> User account information, authentication tokens, and license data</li>
                <li><strong>Notion:</strong> All task data, shopping lists, focus logs, and energy logs are stored in your own Notion workspace</li>
                <li><strong>AWS Lambda:</strong> Temporary processing of voice commands (data is not permanently stored)</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">4.2 Security Measures</h3>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Secure token storage and management</li>
                <li>OAuth2 authentication for Notion and Alexa account linking</li>
                <li>JWT tokens for secure API access</li>
                <li>Regular security audits and updates</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Third-Party Services</h2>
              <p className="text-gray-700 mb-4">
                We use the following third-party services:
              </p>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.1 Amazon Alexa</h3>
              <p className="text-gray-700 mb-4">
                When you use our Alexa skill, Amazon processes your voice commands. Please review Amazon's Privacy Policy for information about how they handle your data.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.2 Notion</h3>
              <p className="text-gray-700 mb-4">
                We integrate with Notion API to create and manage your tasks. All data is stored in your Notion workspace, which is subject to Notion's Privacy Policy and Terms of Service.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.3 Supabase</h3>
              <p className="text-gray-700 mb-4">
                We use Supabase for user authentication and database storage. Supabase's Privacy Policy applies to data stored on their platform.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">5.4 Stripe (Payment Processing)</h3>
              <p className="text-gray-700 mb-4">
                If you purchase a license, payment processing is handled by Stripe. We do not store your payment card information. Please review Stripe's Privacy Policy for details.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Sharing and Disclosure</h2>
              <p className="text-gray-700 mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>With your explicit consent</li>
                <li>To comply with legal obligations or court orders</li>
                <li>To protect our rights, privacy, safety, or property</li>
                <li>In connection with a business transfer (merger, acquisition, etc.)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights and Choices</h2>
              <p className="text-gray-700 mb-4">
                You have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li><strong>Access:</strong> Request access to your personal data</li>
                <li><strong>Correction:</strong> Update or correct your information through your account settings</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                <li><strong>Data Portability:</strong> Export your data from your Notion workspace</li>
                <li><strong>Revoke Access:</strong> Disconnect your Notion account or unlink your Alexa account at any time</li>
                <li><strong>Opt-Out:</strong> Stop using the skill and delete your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Children's Privacy</h2>
              <p className="text-gray-700 mb-4">
                Our services are not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Data Retention</h2>
              <p className="text-gray-700 mb-4">
                We retain your personal information for as long as your account is active or as needed to provide our services. If you delete your account, we will delete your personal information from our systems, except where we are required to retain it for legal purposes.
              </p>
              <p className="text-gray-700 mb-4">
                Note: Data stored in your Notion workspace will remain there until you delete it manually from Notion.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. International Data Transfers</h2>
              <p className="text-gray-700 mb-4">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our services, you consent to the transfer of your information to these countries.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Privacy Policy</h2>
              <p className="text-gray-700 mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Email:</strong> support@notion-data.com<br />
                  <strong>Website:</strong> https://notion-data-user.vercel.app
                </p>
              </div>
            </section>

            <section className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                By using Notion Data, you acknowledge that you have read and understood this Privacy Policy and agree to the collection and use of your information as described herein.
              </p>
            </section>
          </div>
        </Card>
      </main>
    </div>
  );
}

