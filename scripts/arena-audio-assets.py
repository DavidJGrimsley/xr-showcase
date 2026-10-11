"""Prepare playback copies without changing supplied recordings or existing impacts."""
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'temp' / 'Sound'
DEST = ROOT / 'assets' / 'arena' / 'sounds'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def duration(path):
    result = subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', str(path)
    ], text=True)
    return float(result.strip())


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    entries = {}
    files = [('menu', 'BackgroundMusic/MenuMusic.wav', 'menu.m4a'),
             ('battle', 'BackgroundMusic/BattleMusic.wav', 'battle.m4a'),
             ('title', 'SoundRecordings/SR_NeoRockEmSockemRobots.wav', 'title.wav'),
             ('ready', 'SoundRecordings/SR_Ready.wav', 'ready.wav'),
             ('fight', 'SoundRecordings/SR_Fight.wav', 'fight.wav'),
             ('win', 'SoundRecordings/SR_YouWIn.wav', 'win.wav'),
             ('lose', 'SoundRecordings/SR_YouLose.wav', 'lose.wav')]
    files += [(f'round{i}', f'SoundRecordings/SR_Round{i}.wav', f'round{i}.wav') for i in range(1, 6)]
    for key, original, output in files:
        source = SOURCE / original
        target = DEST / output
        codec = ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'] if key in ('menu', 'battle') else ['-c:a', 'pcm_s16le']
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                        '-map_metadata', '-1', '-ar', '48000', '-ac', '2', *codec, str(target)], check=True)
        entries[key] = {'source': f'temp/Sound/{original}', 'sourceSha256': digest(source),
                        'file': output, 'sha256': digest(target), 'bytes': target.stat().st_size,
                        'durationSeconds': duration(target)}
    (DEST / 'audio-manifest.json').write_text(json.dumps({'assets': entries}, indent=2) + '\n', encoding='utf-8')
    print(f'Prepared {len(entries)} assets, {sum(e["bytes"] for e in entries.values()) / 1_000_000:.2f} MB')


if __name__ == '__main__':
    main()
