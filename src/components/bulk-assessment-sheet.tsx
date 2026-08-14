"use client";

import React from "react";
import { X, Award } from "lucide-react";
import { BulkAssessmentForm } from "./bulk-assessment-form";

interface BulkAssessmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionTopic?: string;
  onSuccess?: () => void;
}

export function BulkAssessmentSheet({
  isOpen,
  onClose,
  sessionId,
  sessionTopic,
  onSuccess
}: BulkAssessmentSheetProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-zinc-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[95vw] sm:max-w-6xl max-h-[90vh] bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Log Bulk Assessments
            </h2>
            {sessionTopic && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                {sessionTopic}
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <BulkAssessmentForm
            sessionId={sessionId}
            sessionTopic={sessionTopic}
            onCancel={onClose}
            onSuccess={() => {
              if (onSuccess) onSuccess();
              onClose();
            }}
          />
        </div>
      </div>
    </>
  );
}
