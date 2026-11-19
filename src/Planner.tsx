import Converter from './Converter';
import { Footer, PublicHeader } from './ui';
import SavedPlans from './SavedPlans';
import ProviderLinks from './ProviderLinks';

export default function Planner() {
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="section chart-insights rw-tool-page">
        <header className="rw-page-heading">
          <h1>Transfer planner</h1>
          <p>
            Estimate what your recipient could receive and save the details for your next transfer.
          </p>
        </header>
        <div className="rw-tool-grid">
          <Converter appearance="editorial" />
          <ProviderLinks />
        </div>
        <SavedPlans />
      </main>
      <Footer />
    </>
  );
}
