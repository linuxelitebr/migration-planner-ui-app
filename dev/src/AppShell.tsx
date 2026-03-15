import {
  Brand,
  Masthead,
  MastheadBrand,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  Page,
  PageSection,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
} from "@patternfly/react-core";
import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import MainApp from "../../src/MainApp";

const logoUrl = new URL("/rma-logo.svg", import.meta.url);

export const AppShell: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const onSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton
            isHamburgerButton
            aria-label="Global navigation"
            isSidebarOpen={isSidebarOpen}
            onSidebarToggle={onSidebarToggle}
            id="vertical-nav-toggle"
          />
        </MastheadToggle>
        <MastheadBrand>
          <MastheadLogo href="/">
            <Brand
              src={logoUrl.href}
              heights={{ default: "36px" }}
              alt="OpenShift Migration Advisor"
            />
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar isSidebarOpen={isSidebarOpen} id="vertical-sidebar">
      <PageSidebarBody>Navigation</PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar} isContentFilled>
      <PageSection aria-labelledby="section-1">
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          basename="/"
        >
          <Routes>
            <Route path="/*" element={<MainApp />} />
          </Routes>
        </BrowserRouter>
      </PageSection>
    </Page>
  );
};
AppShell.displayName = "AppShell";
