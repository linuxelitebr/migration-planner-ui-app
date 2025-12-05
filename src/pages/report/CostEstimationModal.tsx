import React, { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Content,
  Divider,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  Popover,
  Split,
  SplitItem,
  Stack,
  StackItem,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { HelpIcon } from '@patternfly/react-icons';

interface CostEstimationModalProps {
  vCPUs: number;
  isOpen: boolean;
  onClose: () => void;
}

type CPURatioOption = '1:1' | '1:2' | '1:4' | '1:6' | '1:8' | '1:10';
type OpenShiftPlatform = 'OpenShift Container Platform' | 'OpenShift Virtualization Engine';
type SLAOption = '24/7' | '8x5';

// Helper function to calculate effective cores needed
const calculateEffectiveCores = (
  vCPUs: number,
  cpuRatio: CPURatioOption
): number => {
  if (vCPUs === 0) {
    return 0;
  }
  const ratioDenominator = parseInt(cpuRatio.split(':')[1], 10);
  return vCPUs / ratioDenominator;
};

// Helper function to calculate number of subscriptions/servers needed
const calculateSubscriptionsNeeded = (
  vCPUs: number,
  cpuRatio: CPURatioOption,
  nodeCpuCores: number,
  nodeSockets: number
): number => {
  if (vCPUs === 0) {
    return 0;
  }

  const cores = calculateEffectiveCores(vCPUs, cpuRatio);
  const coresPerNode = nodeSockets * nodeCpuCores;
  return Math.ceil(cores / coresPerNode);
};

// Helper function to calculate nodes required (decimal)
const calculateNodesRequired = (
  vCPUs: number,
  cpuRatio: CPURatioOption,
  nodeCpuCores: number,
  nodeSockets: number
): number => {
  if (vCPUs === 0) {
    return 0;
  }
  const cores = calculateEffectiveCores(vCPUs, cpuRatio);
  const coresPerNode = nodeSockets * nodeCpuCores;
  return cores / coresPerNode;
};

// Helper function to calculate node utilization percentages
const calculateNodeUtilization = (
  vCPUs: number,
  cpuRatio: CPURatioOption,
  nodeCpuCores: number,
  nodeSockets: number
): number[] => {
  const cores = calculateEffectiveCores(vCPUs, cpuRatio);
  const coresPerNode = nodeSockets * nodeCpuCores;
  const nodesRequired = Math.ceil(cores / coresPerNode);
  
  const utilizations: number[] = [];
  for (let i = 0; i < nodesRequired; i++) {
    const coresUsed = Math.min(cores - i * coresPerNode, coresPerNode);
    const utilization = (coresUsed / coresPerNode) * 100;
    utilizations.push(utilization);
  }
  
  return utilizations;
};

const CostEstimationModal: React.FC<CostEstimationModalProps> = ({ vCPUs: initialVCPUs, isOpen, onClose }) => {
  const [vCPUs, setVCPUs] = useState<number>(initialVCPUs);
  const [cpuRatio, setCpuRatio] = useState<CPURatioOption>('1:4');
  const [nodeCpuCores, setNodeCpuCores] = useState<number>(32);
  const [nodeSockets, setNodeSockets] = useState<number>(2);
  const [openShiftPlatform, setOpenShiftPlatform] = useState<OpenShiftPlatform>('OpenShift Virtualization Engine');
  const [sla, setSLA] = useState<SLAOption>('24/7');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [subscriptionsNeeded, setSubscriptionsNeeded] = useState<number>(0);
  const [effectiveCores, setEffectiveCores] = useState<number>(0);
  const [nodesRequired, setNodesRequired] = useState<number>(0);
  const [nodeUtilizations, setNodeUtilizations] = useState<number[]>([]);

  // Calculate all values whenever any field changes
  const calculateAll = useCallback((): void => {
    const subscriptions = calculateSubscriptionsNeeded(vCPUs, cpuRatio, nodeCpuCores, nodeSockets);
    const cores = calculateEffectiveCores(vCPUs, cpuRatio);
    const nodes = calculateNodesRequired(vCPUs, cpuRatio, nodeCpuCores, nodeSockets);
    const utilizations = calculateNodeUtilization(vCPUs, cpuRatio, nodeCpuCores, nodeSockets);

    setSubscriptionsNeeded(subscriptions);
    setEffectiveCores(cores);
    setNodesRequired(nodes);
    setNodeUtilizations(utilizations);

    if (subscriptions === 0) {
      setEstimatedCost(0);
      return;
    }

    let monthlyCost = 0;
    if (openShiftPlatform === 'OpenShift Container Platform') {
      monthlyCost = subscriptions * 900;
    } else {
      monthlyCost = subscriptions * 200;
    }
    if (sla === '24/7') {
      monthlyCost = monthlyCost * 1.5;
    }

    const annualCost = monthlyCost * 12;
    setEstimatedCost(annualCost);
  }, [vCPUs, cpuRatio, nodeCpuCores, nodeSockets, openShiftPlatform, sla]);

  useEffect(() => {
    setVCPUs(initialVCPUs);
  }, [initialVCPUs]);

  useEffect(() => {
    calculateAll();
  }, [calculateAll]);

  // Ensure calculation runs when modal opens
  useEffect(() => {
    if (isOpen) {
      calculateAll();
    }
  }, [isOpen, calculateAll]);

  const handleClose = (): void => {
    // Reset form
    setVCPUs(initialVCPUs);
    setCpuRatio('1:4');
    setNodeCpuCores(32);
    setNodeSockets(2);
    setOpenShiftPlatform('OpenShift Virtualization Engine');
    setSLA('24/7');
    setEstimatedCost(0);
    setSubscriptionsNeeded(0);
    setEffectiveCores(0);
    setNodesRequired(0);
    setNodeUtilizations([]);
    onClose();
  };

  const coresPerNode = nodeSockets * nodeCpuCores;
  const nodesRequiredRounded = Math.ceil(nodesRequired);
  const perVCPUCost = vCPUs > 0 ? estimatedCost / vCPUs : 0;

  const actions = [
    <Button key="close" variant="primary" onClick={handleClose}>
      Close
    </Button>,
  ];

  return (
    <Modal
      variant={ModalVariant.large}
      title="Bare metal cost estimation"
      isOpen={isOpen}
      onClose={handleClose}
      actions={actions}
    >
      <Grid hasGutter>
        {/* Left Column - Configuration */}
        <GridItem span={6}>
          <Stack hasGutter>
            <StackItem>
              <Title headingLevel="h3" size="lg">Configuration</Title>
            </StackItem>

            <StackItem>
              <Title headingLevel="h4" size="md">Workload Volume</Title>
              <Form>
                <FormGroup 
                  label="Number of vCPUs" 
                  isRequired 
                  fieldId="vcpus"
                  labelHelp={
                    <Popover bodyContent="Total number of virtual CPUs required for your workload.">
                      <button
                        type="button"
                        aria-label="More info"
                        onClick={(e) => e.preventDefault()}
                        className="pf-v6-c-form__group-label-help"
                      >
                        <HelpIcon />
                      </button>
                    </Popover>
                  }
                >
                  <TextInput
                    isRequired
                    type="number"
                    id="vcpus"
                    name="vcpus"
                    value={vCPUs}
                    onChange={(_event, value) => setVCPUs(parseInt(value) || 0)}
                    min={0}
                  />
                </FormGroup>

                <FormGroup 
                  label="CPU ratio" 
                  isRequired 
                  fieldId="cpu-ratio"
                  labelHelp={
                    <Popover bodyContent="Ratio of vCPUs to physical CPU cores (e.g., 1:4 means 4 vCPUs per physical core).">
                      <button
                        type="button"
                        aria-label="More info"
                        onClick={(e) => e.preventDefault()}
                        className="pf-v6-c-form__group-label-help"
                      >
                        <HelpIcon />
                      </button>
                    </Popover>
                  }
                >
                  <FormSelect
                    value={cpuRatio}
                    onChange={(_event, value) => setCpuRatio(value as CPURatioOption)}
                    id="cpu-ratio"
                    name="cpu-ratio"
                  >
                    <FormSelectOption key="1-1" value="1:1" label="1:1" />
                    <FormSelectOption key="1-2" value="1:2" label="1:2" />
                    <FormSelectOption key="1-4" value="1:4" label="1:4" />
                    <FormSelectOption key="1-6" value="1:6" label="1:6" />
                    <FormSelectOption key="1-8" value="1:8" label="1:8" />
                    <FormSelectOption key="1-10" value="1:10" label="1:10" />
                  </FormSelect>
                </FormGroup>
              </Form>
            </StackItem>

            <StackItem>
              <Title headingLevel="h4" size="md">Node Hardware</Title>
              <Form>
                <FormGroup label="Node CPU cores" isRequired fieldId="node-cpu-cores">
                  <FormSelect
                    value={nodeCpuCores}
                    onChange={(_event, value) => setNodeCpuCores(Number(value))}
                    id="node-cpu-cores"
                    name="node-cpu-cores"
                  >
                    <FormSelectOption key="1" value="1" label="1" />
                    <FormSelectOption key="2" value="2" label="2" />
                    <FormSelectOption key="4" value="4" label="4" />
                    <FormSelectOption key="8" value="8" label="8" />
                    <FormSelectOption key="16" value="16" label="16" />
                    <FormSelectOption key="32" value="32" label="32" />
                    <FormSelectOption key="64" value="64" label="64" />
                  </FormSelect>
                </FormGroup>

                <FormGroup label="Node sockets" isRequired fieldId="node-sockets">
                  <FormSelect
                    value={nodeSockets}
                    onChange={(_event, value) => setNodeSockets(Number(value))}
                    id="node-sockets"
                    name="node-sockets"
                  >
                    <FormSelectOption key="2" value="2" label="2" />
                    <FormSelectOption key="4" value="4" label="4" />
                    <FormSelectOption key="6" value="6" label="6" />
                    <FormSelectOption key="8" value="8" label="8" />
                  </FormSelect>
                </FormGroup>
                <Content component="p" style={{ fontSize: '0.875rem', color: '#6a6e73', marginTop: '-0.5rem' }}>
                  (Total {coresPerNode} cores per node)
                </Content>
              </Form>
            </StackItem>

            <StackItem>
              <Title headingLevel="h4" size="md">Software & Support</Title>
              <Form>
                <FormGroup label="OpenShift platform" isRequired fieldId="openshift-platform">
                  <FormSelect
                    value={openShiftPlatform}
                    onChange={(_event, value) => setOpenShiftPlatform(value as OpenShiftPlatform)}
                    id="openshift-platform"
                    name="openshift-platform"
                  >
                    <FormSelectOption
                      key="ocp"
                      value="OpenShift Container Platform"
                      label="OpenShift Container Platform"
                    />
                    <FormSelectOption
                      key="ove"
                      value="OpenShift Virtualization Engine"
                      label="OpenShift Virtualization Engine"
                    />
                  </FormSelect>
                </FormGroup>

                <FormGroup label="SLA" isRequired fieldId="sla">
                  <FormSelect
                    value={sla}
                    onChange={(_event, value) => setSLA(value as SLAOption)}
                    id="sla"
                    name="sla"
                  >
                    <FormSelectOption key="247" value="24/7" label="24/7" />
                    <FormSelectOption key="8x5" value="8x5" label="8x5" />
                  </FormSelect>
                </FormGroup>
              </Form>
            </StackItem>
          </Stack>
        </GridItem>

        {/* Right Column - Estimation & Insights */}
        <GridItem 
          span={6}
          style={{
            backgroundColor: '#f5f5f5',
            padding: '1.5rem',
            borderRadius: '4px'
          }}
        >
          <Stack hasGutter>
            <StackItem>
              <Title headingLevel="h3" size="lg">Estimation & Insights</Title>
            </StackItem>

            <StackItem>
              <Title headingLevel="h4" size="md">Estimated Annual Cost</Title>
              <Content component="p" style={{ fontSize: '2.5rem', fontWeight: 'bold', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                ${estimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Content>
              <Content component="p" style={{ fontSize: '0.875rem', color: '#6a6e73', marginBottom: '1rem' }}>
                ~${perVCPUCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per vCPU/year
              </Content>
            </StackItem>

            <StackItem>
              <Divider />
            </StackItem>

            <StackItem>
              <Title headingLevel="h4" size="md">How it&apos;s calculated:</Title>
              <Stack hasGutter style={{ marginTop: '0.5rem' }}>
                <StackItem>
                  <Split hasGutter>
                    <SplitItem><strong>Total vCPUs:</strong></SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>{vCPUs.toLocaleString('en-US')}</SplitItem>
                  </Split>
                </StackItem>
                <StackItem>
                  <Split hasGutter>
                    <SplitItem><strong>Effective Cores Needed:</strong></SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>{Math.ceil(effectiveCores).toLocaleString('en-US')}</SplitItem>
                  </Split>
                </StackItem>
                <StackItem>
                  <Split hasGutter>
                    <SplitItem><strong>Capacity per Node:</strong></SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>{coresPerNode} cores</SplitItem>
                  </Split>
                </StackItem>
                <StackItem>
                  <Split hasGutter>
                    <SplitItem><strong>Nodes Required:</strong></SplitItem>
                    <SplitItem isFilled />
                    <SplitItem>
                      {nodesRequired.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Rounded to {nodesRequiredRounded})
                    </SplitItem>
                  </Split>
                </StackItem>
              </Stack>
            </StackItem>

            <StackItem>
              <Title headingLevel="h4" size="md">Node Utilization</Title>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {nodeUtilizations.map((utilization, index) => (
                  <div key={index} style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div
                      style={{
                        width: '60px',
                        height: '80px',
                        border: '2px solid #0066cc',
                        borderRadius: '4px',
                        margin: '0 auto',
                        position: 'relative',
                        backgroundColor: '#f0f0f0',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${utilization}%`,
                          backgroundColor: '#0066cc',
                          transition: 'height 0.3s ease',
                        }}
                      />
                    </div>
                    <Content component="p" style={{ fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 'bold' }}>
                      Node {index + 1}
                    </Content>
                    <Content component="p" style={{ fontSize: '0.75rem', color: '#6a6e73' }}>
                      {utilization === 100 ? 'Full' : `${Math.round(utilization)}% Full`}
                    </Content>
                  </div>
                ))}
              </div>
              <Content component="p" style={{ fontSize: '0.875rem', marginTop: '1rem', color: '#6a6e73' }}>
                You need {subscriptionsNeeded} bare metal socket-pair subscription{subscriptionsNeeded !== 1 ? 's' : ''}
              </Content>
              <Content 
                component="p" 
                style={{ 
                  fontSize: '0.75rem', 
                  marginTop: '0.5rem', 
                  color: '#6a6e73',
                  fontStyle: 'italic'
                }}
              >
                Note: This calculation uses only the Bare metal socket-pair model as defined in the{' '}
                <a 
                  href="https://www.redhat.com/en/resources/self-managed-openshift-subscription-guide#section-4" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#0066cc' }}
                >
                  Red Hat OpenShift subscription guide
                </a>
                .
              </Content>
              <Content 
                component="p" 
                style={{ 
                  fontSize: '0.75rem', 
                  marginTop: '0.5rem', 
                  color: '#6a6e73',
                  fontStyle: 'italic'
                }}
              >
                For more information, please contact our {' '}
                <a 
                  href="https://www.redhat.com/en/contact/sales" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#0066cc' }}
                >
                  sales team
                </a>
                .
              </Content>
            </StackItem>
          </Stack>
        </GridItem>
      </Grid>
    </Modal>
  );
};

export default CostEstimationModal;
