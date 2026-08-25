import urllib.request
import json
import time

headers = {'User-Agent': 'Python'}
for i in range(12):
    req = urllib.request.Request('https://api.github.com/repos/ajgrealme-dev/saku-tracker/actions/runs', headers=headers)
    data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    apk_run = [r for r in data['workflow_runs'] if 'APK' in r['name']][0]
    print(f"[{i+1}] APK Build Status: {apk_run['status']} | Conclusion: {apk_run['conclusion']}")
    if apk_run['status'] == 'completed':
        break
    time.sleep(8)
