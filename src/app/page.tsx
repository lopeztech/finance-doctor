'use client';

import Link from 'next/link';

export default function Dashboard() {
  return (
    <>
      <h1 className="page-header">Dashboard</h1>

      <div className="row">
        <div className="col-xl-6 col-lg-6">
          <Link href="/tax" className="text-decoration-none">
            <div className="card border-0 bg-dark text-white mb-3 overflow-hidden">
              <div className="card-body">
                <div className="row">
                  <div className="col-7">
                    <h5 className="text-white mb-3">Tax Health</h5>
                    <p className="text-white text-opacity-75 mb-0">
                      Upload your expenses, categorise them, and get advice on improving your tax position.
                    </p>
                  </div>
                  <div className="col-5 d-flex align-items-center justify-content-center">
                    <i className="fa fa-file-invoice-dollar fa-4x text-white text-opacity-25"></i>
                  </div>
                </div>
              </div>
              <div className="card-footer bg-dark-subtle text-body d-flex align-items-center">
                <span>Get started</span>
                <i className="fa fa-arrow-right ms-auto"></i>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-xl-6 col-lg-6">
          <Link href="/investments" className="text-decoration-none">
            <div className="card border-0 bg-dark text-white mb-3 overflow-hidden">
              <div className="card-body">
                <div className="row">
                  <div className="col-7">
                    <h5 className="text-white mb-3">Investment Health</h5>
                    <p className="text-white text-opacity-75 mb-0">
                      Add your investments, get a portfolio assessment, and see what to do next.
                    </p>
                  </div>
                  <div className="col-5 d-flex align-items-center justify-content-center">
                    <i className="fa fa-chart-line fa-4x text-white text-opacity-25"></i>
                  </div>
                </div>
              </div>
              <div className="card-footer bg-dark-subtle text-body d-flex align-items-center">
                <span>Get started</span>
                <i className="fa fa-arrow-right ms-auto"></i>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
