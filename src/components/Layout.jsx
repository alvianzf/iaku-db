import React from 'react';
import { Link } from 'react-router-dom';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col">
            {/* Menubar */}
            <nav className="bg-blue-600 text-white p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <Link to="/" className="text-xl font-bold">
                        Alumni Lookup
                    </Link>
                    <div className="space-x-4">
                        <Link to="/" className="hover:text-gray-200">
                            Home
                        </Link>
                        <Link to="/search" className="hover:text-gray-200">
                            Search
                        </Link>
                        <Link to="/about" className="hover:text-gray-200">
                            About
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Main content */}
            <main className="flex-grow container mx-auto p-4">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-gray-100 p-4">
                <div className="container mx-auto text-center text-gray-600">
                    © {new Date().getFullYear()} Alumni Lookup. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default Layout;