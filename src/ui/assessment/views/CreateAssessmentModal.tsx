import {
  Alert,
  Button,
  Checkbox,
  type DropEvent,
  FileUpload,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from "@patternfly/react-core";
import React, { useState } from "react";

export type AssessmentMode = "inventory" | "rvtools" | "agent";

interface CreateAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, file: File | null, mode: AssessmentMode) => void;
  mode: AssessmentMode;
  isLoading?: boolean;
  error?: Error | null;
  selectedEnvironment?: { id: string; name: string } | null;
  onSelectEnvironment?: (assessmentName: string) => void;
  /** `true` while the job is actively processing (non-terminal status). */
  isJobProcessing?: boolean;
  /** Progress percentage (0-100) from the VM. */
  jobProgressValue?: number;
  /** Human-readable progress label from the VM. */
  jobProgressLabel?: string;
  /** Error derived from a failed job (null when job hasn't failed). */
  jobError?: Error | null;
  /** `true` while loading assessments and navigating to report after job completion. */
  isNavigatingToReport?: boolean;
}

const isDuplicateNameError = (error: Error | null): boolean =>
  !!error &&
  (/assessment with name '.*' already exists/i.test(error.message || "") ||
    /already exists/i.test(error.message || ""));

const isAbortError = (error: Error | null): boolean => {
  if (!error) return false;
  const message = error.message || "";
  return (
    (typeof (error as { name?: unknown }).name === "string" &&
      (error as { name: string }).name === "AbortError") ||
    (error instanceof DOMException &&
      typeof error.message === "string" &&
      /aborted/i.test(error.message)) ||
    /aborted/i.test(message)
  );
};

export const CreateAssessmentModal: React.FC<CreateAssessmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  mode,
  isLoading = false,
  error = null,
  selectedEnvironment = null,
  onSelectEnvironment: _onSelectEnvironment,
  isJobProcessing = false,
  jobProgressValue = 0,
  jobProgressLabel = "",
  jobError = null,
  isNavigatingToReport = false,
}) => {
  const [assessmentName, setAssessmentName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [isFileLoading, _setIsFileLoading] = useState(false);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");

  // Consent to share aggregated data (RVTools only)
  const [rvtoolsConsentChecked, setRvtoolsConsentChecked] = useState(false);

  const [nameValidationError, setNameValidationError] = useState("");
  const [fileValidationError, setFileValidationError] = useState("");

  // Track dismissed API errors (reset on new submission)
  const [nameErrorDismissed, setNameErrorDismissed] = useState(false);
  const [generalErrorDismissed, setGeneralErrorDismissed] = useState(false);

  // Helper to check if file operations should be disabled (RVTools mode during job creation/processing)
  const isFileOperationsDisabled =
    mode === "rvtools" && (isLoading || isJobProcessing);

  // Combine with existing error logic - job error takes priority
  const effectiveError = jobError || error;

  // Reset dismissed flags when a new error occurs
  React.useEffect(() => {
    if (error || jobError) {
      setNameErrorDismissed(false);
      setGeneralErrorDismissed(false);
    }
  }, [error, jobError]);

  const hasDuplicateNameError =
    !nameErrorDismissed && isDuplicateNameError(effectiveError);
  const hasGeneralApiError =
    !generalErrorDismissed &&
    !!effectiveError &&
    !isDuplicateNameError(effectiveError) &&
    !isAbortError(effectiveError);

  const nameErrorToDisplay =
    nameValidationError ||
    (hasDuplicateNameError ? effectiveError?.message : "");

  const availableEnvironments = selectedEnvironment
    ? [selectedEnvironment]
    : [];

  const getFileConfig = (): {
    title: string;
    fileLabel: string;
    fileDescription: string;
    allowedExtensions: string[];
    accept: string;
    fileLink?: string;
  } => {
    switch (mode) {
      case "inventory":
        return {
          title: "Create Assessment from Inventory",
          fileLabel: "Inventory File (JSON)",
          fileDescription: "Select a JSON inventory file (max 50 MiB)",
          accept: ".json",
          allowedExtensions: ["json"],
        };
      case "rvtools":
        return {
          title: "Create migration assessment from RVTools",
          fileLabel: "RVTools File (Excel)",
          fileDescription: "Select an Excel file from RVTools (max 50 MiB)",
          accept: ".xlsx,.xls",
          allowedExtensions: ["xlsx", "xls"],
          fileLink:
            "https://kubev2v.github.io/assisted-migration-docs/docs/tutorial/#prerequisites-rvtools-file-requirements",
        };
      case "agent":
        return {
          title: "Create migration assessment from Environment",
          fileLabel: "Environment",
          fileDescription: "Select an environment to create assessment from",
          accept: "",
          allowedExtensions: [],
        };
      default:
        return {
          title: "Create Assessment",
          fileLabel: "File",
          fileDescription: "Select a file (max 50 MiB)",
          accept: "*",
          allowedExtensions: [],
        };
    }
  };

  const config = getFileConfig();

  const handleFileChange = (_event: DropEvent, file: File): void => {
    // Prevent file changes during RVTools job creation/processing
    if (isFileOperationsDisabled) {
      return;
    }

    const maxSize = 52428800; // 50 MiB
    const fileExtension = file.name.toLowerCase().split(".").pop();

    if (
      config.allowedExtensions.length > 0 &&
      !config.allowedExtensions.includes(fileExtension || "")
    ) {
      const extensionList = config.allowedExtensions.join(", ");
      setFileValidationError(
        `Unsupported file format. Please select a ${extensionList} file.`,
      );
      setSelectedFile(null);
      setFilename("");
      return;
    }

    if (file.size > maxSize) {
      setFileValidationError(
        "The file is too big. Select a file up to 50 MiB.",
      );
      setSelectedFile(null);
      setFilename("");
      return;
    }

    setFileValidationError("");
    setSelectedFile(file);
    setFilename(file.name);
  };

  const handleFileClear = (): void => {
    // Prevent file clearing during RVTools job creation/processing
    if (isFileOperationsDisabled) {
      return;
    }

    setSelectedFile(null);
    setFilename("");
    setFileValidationError("");
  };

  const validateForm = (): boolean => {
    let isValid = true;

    if (!assessmentName.trim()) {
      setNameValidationError("Assessment name is required");
      isValid = false;
    } else {
      setNameValidationError("");
    }

    if (mode === "agent" && !selectedEnvironment) {
      setFileValidationError("Environment selection is required");
      isValid = false;
    } else if (mode !== "agent" && !selectedFile) {
      setFileValidationError("File upload is required");
      isValid = false;
    } else if (!fileValidationError) {
      setFileValidationError("");
    }

    return isValid;
  };

  const handleSubmit = (): void => {
    if (validateForm()) {
      onSubmit(assessmentName.trim(), selectedFile, mode);
    }
  };

  // Simple close handler - just reset form and call parent's onClose
  // Parent (Assessment.tsx) handles all cancel logic
  const handleClose = (): void => {
    setAssessmentName("");
    setSelectedFile(null);
    setFilename("");
    setNameValidationError("");
    setFileValidationError("");
    setSelectedEnvironmentId("");
    setNameErrorDismissed(true);
    setGeneralErrorDismissed(true);
    setRvtoolsConsentChecked(false);
    onClose();
  };

  const isFormValid =
    assessmentName.trim() &&
    (mode === "agent" ? selectedEnvironment : selectedFile);

  const isButtonDisabled =
    !isFormValid ||
    (mode === "rvtools" && !rvtoolsConsentChecked) ||
    isLoading ||
    !!nameErrorToDisplay ||
    !!fileValidationError ||
    hasGeneralApiError ||
    !!isJobProcessing ||
    isNavigatingToReport;

  const progressMessage = isNavigatingToReport
    ? "Opening report..."
    : `${jobProgressValue}% done. ${jobProgressLabel}`;

  const actions = [
    <Button
      key="create"
      variant="primary"
      onClick={handleSubmit}
      isDisabled={isButtonDisabled}
      isLoading={isLoading || isJobProcessing || isNavigatingToReport}
    >
      Create Migration Assessment
    </Button>,
    <Button
      key="cancel"
      variant="link"
      onClick={handleClose}
      isDisabled={isNavigatingToReport}
    >
      Cancel
    </Button>,
    (isJobProcessing || isNavigatingToReport) && (
      <div key="progress" style={{ marginRight: "auto" }}>
        {progressMessage}
      </div>
    ),
  ].filter(Boolean);

  return (
    <Modal variant="medium" isOpen={isOpen} onClose={handleClose}>
      <ModalHeader title={config.title} />
      <ModalBody>
        <Form>
          <FormGroup
            label="Assessment Name"
            isRequired
            fieldId="assessment-name"
          >
            <TextInput
              isRequired
              type="text"
              id="assessment-name"
              name="assessment-name"
              value={assessmentName}
              onChange={(_event, value) => {
                setAssessmentName(value);
                if (nameValidationError && value.trim()) {
                  setNameValidationError("");
                }
                setNameErrorDismissed(true);
                setGeneralErrorDismissed(true);
              }}
              validated={nameErrorToDisplay ? "error" : "default"}
              placeholder="Enter assessment name"
            />
            {nameErrorToDisplay && (
              <HelperText>
                <HelperTextItem variant="error">
                  {nameErrorToDisplay}
                </HelperTextItem>
              </HelperText>
            )}
          </FormGroup>

          {mode === "agent" ? (
            <FormGroup
              label={config.fileLabel}
              isRequired
              fieldId="assessment-environment"
            >
              <div
                style={{
                  fontSize: "14px",
                  color: "var(--pf-global--Color--200)",
                  marginBottom: "8px",
                }}
              >
                {config.fileDescription}
              </div>
              <FormSelect
                value={selectedEnvironmentId}
                onChange={(_event, value) => {
                  setSelectedEnvironmentId(value);
                  if (fileValidationError && value) {
                    setFileValidationError("");
                  }
                }}
                validated={fileValidationError ? "error" : "default"}
              >
                <FormSelectOption value="" label="Select an environment" />
                {availableEnvironments.map((env) => (
                  <FormSelectOption
                    key={env.id}
                    value={env.id}
                    label={env.name}
                  />
                ))}
              </FormSelect>
              {fileValidationError && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem
                      variant="error"
                      data-testid="upload-field-helper-text"
                    >
                      {fileValidationError}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          ) : (
            <FormGroup
              label={config.fileLabel}
              isRequired
              fieldId="assessment-file"
            >
              <div
                style={{
                  fontSize: "14px",
                  color: "var(--pf-global--Color--200)",
                  marginBottom: "8px",
                }}
              >
                {config.fileDescription}
                <br />
                {config.fileLink && (
                  <a
                    href={config.fileLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    RVTools File Requirements
                  </a>
                )}
              </div>
              <FileUpload
                id="assessment-file"
                type="text"
                value=""
                filename={filename}
                filenamePlaceholder="Drag and drop a file or select one"
                onFileInputChange={handleFileChange}
                onClearClick={handleFileClear}
                isLoading={isFileLoading}
                allowEditingUploadedText={false}
                browseButtonText="Select"
                validated={fileValidationError ? "error" : "default"}
                accept={config.accept}
                hideDefaultPreview
                isDisabled={isFileOperationsDisabled}
              />
              {fileValidationError && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem
                      variant="error"
                      data-testid="upload-field-helper-text"
                    >
                      {fileValidationError}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
              {mode === "rvtools" && (
                <div style={{ marginTop: "8px" }}>
                  <Checkbox
                    id="rvtools-data-share-consent"
                    label="I agree to share aggregated data about my environment with Red Hat."
                    isChecked={rvtoolsConsentChecked}
                    onChange={(_event, checked) => {
                      setRvtoolsConsentChecked(Boolean(checked));
                    }}
                    isRequired
                  />
                </div>
              )}
            </FormGroup>
          )}
        </Form>

        {hasGeneralApiError && (
          <Alert
            variant="danger"
            title="Failed to create assessment"
            style={{ marginTop: "16px", marginBottom: "0" }}
            isInline
          >
            {effectiveError?.message ||
              "An error occurred while creating the assessment"}
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>{actions}</ModalFooter>
    </Modal>
  );
};

CreateAssessmentModal.displayName = "CreateAssessmentModal";

export default CreateAssessmentModal;
