import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface CLIVerificationCommandsProps {
  jobId?: string;
  attestationB64?: string;
  outputHash?: string;
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: no-op
    }
  };

  return (
    <div>
      <p className="text-sm font-medium mb-1.5">{label}</p>
      <div className="relative group">
        <pre className="bg-zinc-900 text-zinc-100 rounded-lg p-4 pr-12 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
          {command}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded-md bg-zinc-700/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function CLIVerificationCommands({ jobId, attestationB64, outputHash }: CLIVerificationCommandsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Verify via CLI</CardTitle>
        </div>
        <CardDescription>
          Don't trust this website? Verify the attestation independently using these commands.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <CommandBlock
          label="1. Install the Epsilon attestation verifier"
          command="pip install epsilon-attestation-verifier"
        />

        {jobId ? (
          <CommandBlock
            label="2. Verify attestation by job ID"
            command={`curl -s https://api.epsilon.dev/api/verify/${encodeURIComponent(jobId)} | python -m epsilon_verifier`}
          />
        ) : attestationB64 ? (
          <CommandBlock
            label="2. Verify attestation from base64 (pipe your document)"
            command="echo '<paste-your-base64-attestation>' | python -m epsilon_verifier --stdin"
          />
        ) : (
          <CommandBlock
            label="2. Verify attestation"
            command="echo '<base64-attestation>' | python -m epsilon_verifier --stdin"
          />
        )}

        <CommandBlock
          label="3. Download AWS Nitro root certificate"
          command="curl -O https://aws-nitro-enclaves.amazonaws.com/AWS_NitroEnclaves_Root-G1.zip"
        />

        {outputHash && (
          <CommandBlock
            label="4. Verify output hash"
            command={`echo -n '<your-output-data>' | sha256sum\n# Expected: ${outputHash}`}
          />
        )}
      </CardContent>
    </Card>
  );
}
