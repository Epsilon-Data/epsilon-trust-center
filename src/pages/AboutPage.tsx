import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Cpu, Link2, FileCheck, Hash, Lock } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">How Epsilon Verification Works</h1>
      <p className="text-muted-foreground mb-8">
        Understanding the cryptographic proof behind every enclave execution.
      </p>

      {/* Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            What is Enclave Attestation?
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>
            When your code runs inside an AWS Nitro Enclave, the enclave hardware
            generates a cryptographically signed document called an <strong>attestation</strong>.
            This document is signed by the Nitro Hypervisor using a certificate chain
            that traces back to an AWS root certificate.
          </p>
          <p>
            The attestation cannot be forged. Even the Epsilon platform operator
            cannot create a valid attestation - only the AWS Nitro hardware can.
            This means you can verify independently that your code ran in a genuine
            enclave without trusting anyone.
          </p>
        </CardContent>
      </Card>

      {/* Trust Chain */}
      <h2 className="text-xl font-semibold mb-4">The Trust Chain</h2>
      <div className="space-y-4 mb-8">
        {[
          {
            icon: Lock,
            title: "1. AWS Root Certificate",
            desc: "AWS publishes a root certificate for Nitro Enclaves. This is the trust anchor. Its fingerprint is publicly known and can be verified against AWS documentation.",
            color: "text-blue-600",
          },
          {
            icon: Link2,
            title: "2. Certificate Chain",
            desc: "The attestation includes a chain of certificates from the AWS root down to the enclave instance. Each certificate is signed by the one above it, forming an unbroken chain of trust.",
            color: "text-blue-600",
          },
          {
            icon: Shield,
            title: "3. COSE_Sign1 Signature",
            desc: "The attestation document is a COSE_Sign1 structure (CBOR Object Signing and Encryption). It uses ES384 (ECDSA with P-384 curve and SHA-384) for the signature. The signature is verified using the enclave certificate's public key.",
            color: "text-purple-600",
          },
          {
            icon: Cpu,
            title: "4. PCR Values (Platform Configuration Registers)",
            desc: "PCR0 is the hash of the entire Enclave Image File (EIF) - the exact binary running in the enclave. PCR1 is the Linux kernel hash, PCR2 is the application hash. These are hardware-measured and cannot be spoofed.",
            color: "text-orange-600",
          },
          {
            icon: FileCheck,
            title: "5. User Data (Execution Proof)",
            desc: "The attestation's user_data field contains the job ID, output hash, timestamp, and a random nonce. This binds the attestation to a specific execution and prevents replay attacks.",
            color: "text-yellow-600",
          },
          {
            icon: Hash,
            title: "6. Output Hash",
            desc: "The SHA-256 hash of the execution output is embedded in the attestation. Anyone can hash the output they received and compare it with the attested hash to verify integrity.",
            color: "text-green-600",
          },
        ].map((step) => (
          <Card key={step.title}>
            <CardContent className="p-4 flex gap-4">
              <step.icon className={`h-6 w-6 ${step.color} shrink-0 mt-0.5`} />
              <div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Verify Independently */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Verify Without Trusting Us</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>You don't need to trust the Epsilon platform. Here's how to verify an attestation yourself:</p>
          <ol>
            <li>
              <strong>Get the raw attestation document</strong> from the job's verification page (base64-encoded CBOR).
            </li>
            <li>
              <strong>Download the AWS Nitro root certificate</strong> from{" "}
              <a href="https://aws-nitro-enclaves.amazonaws.com/AWS_NitroEnclaves_Root-G1.zip" target="_blank" rel="noopener noreferrer">
                AWS official source
              </a>.
            </li>
            <li>
              <strong>Decode the CBOR/COSE_Sign1 structure</strong> using any CBOR library.
            </li>
            <li>
              <strong>Verify the certificate chain</strong> from the root cert through intermediates to the enclave certificate.
            </li>
            <li>
              <strong>Verify the COSE_Sign1 signature</strong> using the enclave certificate's public key (ES384).
            </li>
            <li>
              <strong>Check PCR values</strong> against the published expected values for the Epsilon enclave version.
            </li>
            <li>
              <strong>Compare the output hash</strong> in user_data against the SHA-256 of your execution results.
            </li>
          </ol>
          <p>
            We also provide the{" "}
            <a href="https://github.com/epsilon-data/epsilon-attestation-verifier" target="_blank" rel="noopener noreferrer">
              epsilon-attestation-verifier
            </a>{" "}
            - a standalone Python tool that automates all these steps.
          </p>
        </CardContent>
      </Card>

      {/* AWS Spec */}
      <Card>
        <CardHeader>
          <CardTitle>AWS Nitro Attestation Specification</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <table>
            <tbody>
              <tr><td className="font-medium">Signature Algorithm</td><td>ES384 (ECDSA P-384 + SHA-384)</td></tr>
              <tr><td className="font-medium">Document Format</td><td>COSE_Sign1 (CBOR tag 18)</td></tr>
              <tr><td className="font-medium">PCR Hash</td><td>SHA-384 (48 bytes)</td></tr>
              <tr><td className="font-medium">Max User Data</td><td>512 bytes</td></tr>
              <tr><td className="font-medium">Max Nonce</td><td>512 bytes</td></tr>
              <tr><td className="font-medium">Max Certificate</td><td>1,024 bytes</td></tr>
              <tr><td className="font-medium">Max Payload</td><td>16,384 bytes</td></tr>
              <tr><td className="font-medium">Root Cert CN</td><td>aws.nitro-enclaves</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
