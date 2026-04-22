import React from "react";
import { FileText, File, ExternalLink, Download } from "lucide-react";

const FILE_ICONS = {
  "application/pdf": FileText,
  "image/jpeg": File,
  "image/jpg": File,
  "image/png": File,
  "application/msword": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
};

export default function AttachmentList({ attachments = [], emptyMessage = "No attachments" }) {
  if (!attachments || attachments.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic dark:text-slate-500">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment, index) => {
        const url = typeof attachment === "string" ? attachment : attachment.url;
        const name = typeof attachment === "string" ? `Attachment ${index + 1}` : (attachment.name || `Attachment ${index + 1}`);
        const uploadedBy = attachment.uploaded_by;
        const Icon = FILE_ICONS[attachment.type] || File;

        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors group"
          >
            <Icon className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-indigo-700 truncate font-medium">{name}</p>
              {uploadedBy && (
                <p className="text-xs text-indigo-400 capitalize">Uploaded by {uploadedBy}</p>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 shrink-0" />
          </a>
        );
      })}
    </div>
  );
}