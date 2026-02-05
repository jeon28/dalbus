"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import styles from './mypage.module.css';

export default function MyPage() {
    const { user, logout, isHydrated } = useServices();
    const router = useRouter();

    if (!isHydrated) return null;

    if (!user) {
        return (
            <main className={styles.main}>
                <header className={`${styles.header} glass`}>
                    <div className="container">
                        <h1 className={styles.title}>내 구독 정보</h1>
                    </div>
                </header>
                <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>로그인이 필요한 페이지입니다.</p>
                    <button
                        className={styles.actionBtn}
                        style={{ padding: '12px 24px', background: 'var(--primary)', color: 'white', borderRadius: '12px' }}
                        onClick={() => router.push('/login')}
                    >
                        로그인하러 가기
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>내 구독 정보</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.section}>
                    <h3>이용 중인 서비스</h3>
                    <div className={`${styles.activeCard} glass animate-fade-in`}>
                        <div className={styles.cardTop}>
                            <span className={styles.serviceIcon}>🎧</span>
                            <div className={styles.serviceInfo}>
                                <h4>Tidal Family Plan</h4>
                                <p>2026.02.28 까지</p>
                            </div>
                            <span className={styles.statusBadge}>이용 중</span>
                        </div>

                        <div className={styles.credentials}>
                            <div className={styles.credItem}>
                                <span>아이디</span>
                                <strong>shareking_user01@gmail.com</strong>
                            </div>
                            <div className={styles.credItem}>
                                <span>비밀번호</span>
                                <strong>sk123456!</strong>
                            </div>
                        </div>

                        <p className={styles.notice}>
                            * 계정 정보를 타인과 공유 시 불이익을 받을 수 있습니다.
                        </p>
                    </div>
                </section>

                <section className={styles.section}>
                    <h3>내 정보 관리</h3>
                    <div className={`${styles.menuList} glass`}>
                        <div className={styles.menuItem}>결제 내역 확인<span>›</span></div>
                        <div className={styles.menuItem}>알림 설정<span>›</span></div>
                        <div className={styles.menuItem}>고객 센터<span>›</span></div>
                        <div className={styles.menuItem} onClick={() => { logout(); router.push('/'); }}>로그아웃<span>›</span></div>
                    </div>
                </section>
            </div>

            <nav className={`${styles.bottomNav} glass`}>
                <Link href="/" className={styles.navItem}>🏠</Link>
                <Link href="/mypage" className={styles.navItem}>👤</Link>
            </nav>
        </main>
    );
}
