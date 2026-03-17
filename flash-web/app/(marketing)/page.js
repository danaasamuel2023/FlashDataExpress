'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Zap, Shield, Clock, CheckCircle, CreditCard, Phone, Wifi, Star, Users, TrendingUp, Smartphone } from 'lucide-react';
import NetworkIcon from '@/components/shared/NetworkIcon';
import { useAuth } from '@/context/AuthContext';

const networkData = [
  { id: 'YELLO', label: 'MTN', color: '#FFCC00', bgClass: 'from-yellow-500 to-amber-500', bundles: [
    { gb: '1', price: '4.15', rollover: 'N/A', duration: 'No Expiry' },
    { gb: '2', price: '9.00', rollover: 'N/A', duration: 'No Expiry' },
    { gb: '5', price: '23.00', rollover: 'N/A', duration: 'No Expiry' },
    { gb: '10', price: '42.00', rollover: 'N/A', duration: 'No Expiry' },
    { gb: '15', price: '60.00', rollover: 'N/A', duration: 'No Expiry' },
    { gb: '20', price: '80.00', rollover: 'N/A', duration: 'No Expiry' },
    { gb: '25', price: '100.00', rollover: 'N/A', duration: 'No Expiry' },
    { gb: '50', price: '200.00', rollover: 'N/A', duration: 'No Expiry' },
  ]},
  { id: 'AT_PREMIUM', label: 'AirtelTigo', color: '#0066CC', bgClass: 'from-blue-600 to-blue-700', bundles: [
    { gb: '1', price: '3.80', rollover: 'Yes', duration: '60 Days' },
    { gb: '2', price: '7.50', rollover: 'Yes', duration: '60 Days' },
    { gb: '5', price: '18.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '10', price: '35.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '15', price: '52.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '25', price: '85.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '50', price: '165.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '100', price: '320.00', rollover: 'Yes', duration: '60 Days' },
  ]},
  { id: 'TELECEL', label: 'Telecel', color: '#E60000', bgClass: 'from-red-600 to-red-700', bundles: [
    { gb: '5', price: '18.50', rollover: 'Yes', duration: '60 Days' },
    { gb: '10', price: '36.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '15', price: '52.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '20', price: '68.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '25', price: '85.00', rollover: 'Yes', duration: '60 Days' },
    { gb: '50', price: '165.00', rollover: 'Yes', duration: '60 Days' },
  ]},
];

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeNetwork, setActiveNetwork] = useState('YELLO');
  const [expandedCard, setExpandedCard] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentNetwork = networkData.find(n => n.id === activeNetwork);

  return (
    <>
      {/* Hero Banner — orange/rose gradient */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-rose-500/5 pointer-events-none dark:from-orange-500/5 dark:to-rose-500/3" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-10 sm:pb-16">
          {/* Greeting banner — orange/rose gradient */}
          <div className="bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl p-5 sm:p-8 mb-8 shadow-xl shadow-orange-500/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                  Buy Cheap Data Bundles Instantly
                </h1>
                <p className="text-white/90 mt-2 text-sm sm:text-base">
                  MTN, Telecel & AirtelTigo — Best prices in Ghana. No account needed.
                </p>
                <p className="text-white font-bold text-xs mt-3 bg-black/20 inline-block px-3 py-1.5 rounded-full border border-white/20">
                  Ghana's Fastest Data Delivery
                </p>
              </div>
              <div className="flex gap-2 sm:gap-3 flex-wrap">
                <Link href="/quick-buy">
                  <button className="px-5 py-2.5 sm:px-6 sm:py-3 bg-gray-800 text-orange-400 font-bold text-sm rounded-xl shadow-lg hover:bg-gray-700 transition-all active:scale-[0.98]">
                    Buy Data Now
                  </button>
                </Link>
                <Link href="/sign-up">
                  <button className="px-5 py-2.5 sm:px-6 sm:py-3 bg-white/15 text-white font-bold text-sm rounded-xl border border-white/20 hover:bg-white/25 transition-all active:scale-[0.98]">
                    Create Account
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* System Status Banner */}
          <div className="bg-gray-800 dark:bg-navy-dark rounded-2xl p-4 sm:p-5 mb-8 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full animate-ping absolute" />
                  <div className="w-3 h-3 bg-emerald-400 rounded-full relative" />
                </div>
                <div className="text-white">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wide">System Online</span>
                    <span className="px-2 py-0.5 bg-orange-500 text-white rounded-full text-[10px] sm:text-xs font-bold">24/7</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
                    <Clock className="w-3 h-3" />
                    <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <div className="flex items-center gap-1.5 bg-gray-700/60 backdrop-blur-sm px-2.5 py-1.5 rounded-full whitespace-nowrap">
                  <Wifi className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] sm:text-xs text-gray-300 font-medium">Always Open</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-700/60 backdrop-blur-sm px-2.5 py-1.5 rounded-full whitespace-nowrap">
                  <Zap className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] sm:text-xs text-gray-300 font-medium">Instant Delivery</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-700/60 backdrop-blur-sm px-2.5 py-1.5 rounded-full whitespace-nowrap">
                  <Shield className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] sm:text-xs text-gray-300 font-bold">Paystack Secured</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Network Buttons */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-lg mb-8">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-blue-600" />
            <div className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Buy — Select Network</h2>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {networkData.map((net) => {
                  const btnColors = net.id === 'YELLO'
                    ? 'border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-500/10 hover:bg-yellow-100 dark:hover:bg-yellow-500/20 hover:border-yellow-400'
                    : net.id === 'TELECEL'
                    ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 hover:border-red-400'
                    : 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:border-blue-400';
                  return (
                    <Link href="/quick-buy" key={net.id}>
                      <div className={`flex flex-col items-center p-3 sm:p-4 rounded-2xl border-2 ${btnColors} hover:shadow-lg transition-all duration-200 active:scale-[0.97]`}>
                        <div className="mb-1.5 sm:mb-2">
                          <NetworkIcon network={net.id} size={40} />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">{net.label}</span>
                        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">Buy Now →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[
              { icon: Users, value: '10,000+', label: 'Happy Customers', color: 'text-orange-500' },
              { icon: Zap, value: '< 30s', label: 'Delivery Time', color: 'text-emerald-500' },
              { icon: Shield, value: '100%', label: 'Secure Payments', color: 'text-orange-500' },
              { icon: Clock, value: '24/7', label: 'Always Available', color: 'text-emerald-500' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 text-center hover:border-orange-300 dark:hover:border-orange-500/30 transition-all">
                <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-2`} />
                <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / Packages */}
      <section id="pricing" className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-lg">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 via-red-500 to-blue-600" />
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Our Data Packages</h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">No hidden fees. What you see is what you pay.</p>
              </div>

              {/* Network Tabs */}
              <div className="flex items-center gap-1 mb-6 bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-1.5">
                {networkData.map((network) => (
                  <button
                    key={network.id}
                    onClick={() => { setActiveNetwork(network.id); setExpandedCard(null); }}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex-1 justify-center ${
                      activeNetwork === network.id
                        ? `bg-gradient-to-r ${network.bgClass} text-white shadow-lg`
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-800'
                    }`}
                  >
                    <NetworkIcon network={network.id} size={20} />
                    <span className="hidden sm:inline">{network.label}</span>
                  </button>
                ))}
              </div>

              {/* Bundle Cards Grid */}
              {(() => {
                const cardStyles = {
                  YELLO: { bg: 'bg-yellow-400', text: 'text-black', textMuted: 'text-black/60', border: 'border-black/10', ringSelected: 'ring-black/30', expandBorder: 'border-yellow-300 dark:border-yellow-700', priceColor: 'text-yellow-600 dark:text-yellow-400', buyBtn: 'bg-yellow-400 hover:bg-yellow-500 text-black' },
                  AT_PREMIUM: { bg: 'bg-purple-600', text: 'text-white', textMuted: 'text-white/60', border: 'border-white/20', ringSelected: 'ring-white/30', expandBorder: 'border-purple-300 dark:border-purple-700', priceColor: 'text-purple-600 dark:text-purple-400', buyBtn: 'bg-purple-600 hover:bg-purple-700 text-white' },
                  TELECEL: { bg: 'bg-red-600', text: 'text-white', textMuted: 'text-white/60', border: 'border-white/20', ringSelected: 'ring-white/30', expandBorder: 'border-red-300 dark:border-red-700', priceColor: 'text-red-600 dark:text-red-400', buyBtn: 'bg-red-600 hover:bg-red-700 text-white' },
                };
                const s = cardStyles[activeNetwork];

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {currentNetwork.bundles.map((b) => {
                      const cardKey = `${activeNetwork}-${b.gb}`;
                      const isExpanded = expandedCard === cardKey;

                      return (
                        <React.Fragment key={cardKey}>
                          {/* Bundle Card */}
                          <div
                            onClick={() => setExpandedCard(isExpanded ? null : cardKey)}
                            className={`${s.bg} ${s.text} overflow-hidden cursor-pointer transition-all hover:shadow-lg rounded-2xl hover:-translate-y-1 ${
                              isExpanded ? `ring-2 ${s.ringSelected} shadow-xl -translate-y-1` : ''
                            }`}
                          >
                            {/* Top: Capacity + Logo */}
                            <div className="p-4 flex items-center justify-between">
                              <h3 className="text-2xl sm:text-3xl font-bold">{b.gb} GB</h3>
                              <NetworkIcon network={activeNetwork} size={36} />
                            </div>

                            {/* Bottom Stats Bar */}
                            <div className={`grid grid-cols-3 border-t ${s.border}`}>
                              <div className="p-2 text-center">
                                <div className="text-sm font-bold">₵{b.price}</div>
                                <div className={`text-[10px] ${s.textMuted} uppercase`}>Price</div>
                              </div>
                              <div className={`p-2 text-center border-x ${s.border}`}>
                                <div className="text-sm font-bold">{b.rollover === 'Yes' ? 'Yes' : 'N/A'}</div>
                                <div className={`text-[10px] ${s.textMuted} uppercase`}>Rollover</div>
                              </div>
                              <div className="p-2 text-center">
                                <div className="text-sm font-bold">{b.duration}</div>
                                <div className={`text-[10px] ${s.textMuted} uppercase`}>Duration</div>
                              </div>
                            </div>
                          </div>

                          {/* Expansion Panel */}
                          {isExpanded && (
                            <div className={`col-span-2 sm:col-span-3 lg:col-span-4 bg-white dark:bg-gray-800 rounded-2xl p-3 sm:p-4 shadow-md border ${s.expandBorder}`}>
                              <div className="flex items-center justify-center gap-2 mb-3">
                                <NetworkIcon network={activeNetwork} size={28} />
                                <span className="font-bold text-gray-900 dark:text-white text-base">{b.gb}GB</span>
                                <span className="text-gray-400 dark:text-gray-500 text-sm">&mdash;</span>
                                <span className={`font-bold ${s.priceColor} text-base`}>GH₵ {b.price}</span>
                              </div>

                              <div className="flex gap-2 max-w-md mx-auto">
                                <input
                                  type="tel"
                                  value={phoneNumber}
                                  onChange={(e) => setPhoneNumber(e.target.value)}
                                  placeholder="0XXXXXXXXX"
                                  className="flex-1 px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none text-center font-medium text-sm"
                                />
                                <Link href={`/quick-buy?network=${activeNetwork}&gb=${b.gb}&phone=${phoneNumber}`}>
                                  <button className={`px-5 py-2.5 ${s.buyBtn} font-bold rounded-xl whitespace-nowrap text-sm transition-colors`}>
                                    Buy ₵{b.price}
                                  </button>
                                </Link>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 sm:pb-16">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-lg">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-rose-500" />
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-6">How It Works</h2>
              <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
                {[
                  { num: '1', icon: Smartphone, title: 'Select bundle', desc: 'Choose your network and data package.' },
                  { num: '2', icon: CreditCard, title: 'Pay with MoMo', desc: 'Secure payment via Mobile Money or Paystack.' },
                  { num: '3', icon: Zap, title: 'Receive instantly', desc: 'Data delivered to the phone within seconds.' },
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mb-1">STEP {step.num}</div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{step.title}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 sm:pb-16">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-lg">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-rose-500" />
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">What Our Customers Say</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { name: 'Kofi B.', location: 'Accra', text: 'Flash Data Express is my go-to for data bundles. Lightning fast delivery every single time, and the prices are unbeatable.', rating: 5 },
                  { name: 'Esi D.', location: 'Kumasi', text: 'As a reseller, I need reliable service. Flash Data Express has never let me down. My customers love the speed.', rating: 5 },
                  { name: 'Mensah T.', location: 'Tamale', text: 'Buying data for my whole family is so easy now. MoMo payment works perfectly. Highly recommended!', rating: 5 },
                ].map((review) => (
                  <div key={review.name} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">&ldquo;{review.text}&rdquo;</p>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{review.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{review.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 sm:pb-16">
          <div className="bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl p-6 sm:p-10 text-center shadow-xl shadow-orange-500/20">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Ready to get started?</h2>
            <p className="text-white/90 mt-2 max-w-md mx-auto text-sm">
              Join thousands of Ghanaians who trust Flash Data Express for affordable, instant data bundles.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <Link href="/quick-buy">
                <button className="px-6 py-3 bg-gray-800 text-orange-400 font-bold text-sm rounded-xl shadow-lg hover:bg-gray-700 transition-all active:scale-[0.98]">
                  Buy Data Now <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              </Link>
              <Link href="/sign-up">
                <button className="px-6 py-3 bg-white/15 text-white font-bold text-sm rounded-xl border border-white/20 hover:bg-white/25 transition-all active:scale-[0.98]">
                  Create Account
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
